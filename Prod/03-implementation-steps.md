After grounding the existing systems (which I made up with AI in step [01](./01-fake-the-dealership-systems.md)), it seems we have various forms of API here. Even though they are all REST APIs, they accept different paths and HTTP methods.

I designed the approach for this software in [02](./02-system-design.md), and now I'm going to implement it. I assumed that this system would only be used on a local network, so I didn't mention any kind of authentication or access control in the design step.

So here is the first step: I initiate the .NET 10 application without any authentication.
```bash
cd ../src/
dotnet new webapi --name UnifiedDocuments
```
Then I remove the default files that the .NET CLI scaffolds for me, and try running
```bash
dotnet run --project UnifiedDocuments
```
to check that it works. I add a `.gitignore` to keep the `bin/` and `obj/` folders out of Git, since the .NET CLI does not do this for me.

Next, I would write the user stories, with one story per endpoint. In the first, the user wants to list the documents for a VIN, so that they know whether a car has any documents to learn from. In the second, the user wants to read the details of a document, for example to download or print it. Lastly, the user wants to list the remaining documents. All of them depend on the same enabler: data. We cannot verify that a feature works without data. We could obviously use mocks, but not for this application, because QA still needs to verify the features with real data. So let's start with the data.

Based on the system design, we already know the data schema. I would create a library project that holds the `DbContext`, the EF Core package references, the entities, the entity configurations and then the migrations.
```bash
dotnet new classlib --name UnifiedDocuments.Data
```
This is the abstraction layer: the boundary between the application layer and the external data source. The application should not know whether it is SQLite, Postgres or any SQL at all - Law of Demeter.

Admittedly, it would be cleaner to have a single contracts class library that contains the interfaces and business models. Both the data layer and the business layer would depend on that contracts project, and everything would be wired together in the entry project (A lot of benefits as Uncle Bob said so). However, this application is fairly small, so I'll start with the simpler approach.

Why SQLite and not Postgres? This tool runs only locally, on a single machine. SQLite needs no server, no Docker and no password; the database is just a file next to the app. That is exactly what a simple first setup needs. The data is also only an index: it can be rebuilt from the dealership systems with a full sync, so losing or replacing the file is not a disaster.

> Boring approach first, not yet adopt fancy practices unless we need them to solve a problem.

When would we use Postgres? When the tool outgrows a single machine:
- the API runs on several instances, or the sync worker runs as a separate process, and they all need the same database;
- QA or several users need one shared environment instead of a file per machine;
- writes become heavy enough that SQLite's single-writer lock slows the sync down;
- we need full-text search or trigram matching for partial VINs, which Postgres supports natively.

That is also why I chose EF Core. Switching to Postgres means changing the provider registration inside `AddUnifiedDocumentsData`, the connection string, and generating a new migration. Migrations are specific to each database provider, so it is not completely free, but no data needs to be migrated because a full sync rebuilds the index.

I add the EF Core packages. The SQLite provider and the snake_case naming convention go into the data project. The design-time package goes into the entry project, so the `dotnet ef` CLI can build the app.
```bash
dotnet add UnifiedDocuments.Data package Microsoft.EntityFrameworkCore.Sqlite
dotnet add UnifiedDocuments.Data package EFCore.NamingConventions
dotnet add UnifiedDocuments package Microsoft.EntityFrameworkCore.Design
dotnet add UnifiedDocuments reference UnifiedDocuments.Data/UnifiedDocuments.Data.csproj
```
Following the index record in the design, I model two entities:
- `SourceDocument`: one row per document listed by a dealership system. The source name and the source document ID together are unique. It stores metadata and the content hash, but never the content itself.
- `DocumentVin`: one row per VIN found in a document. A document can contain several VINs, and a document with no VIN rows is "unlinked", so it stays visible instead of being dropped.

Each entity has its own `IEntityTypeConfiguration` for table names, lengths and indexes, including an index on `vin` for the main lookup. `UnifiedDocumentsDbContext` applies all configurations from the assembly. SQLite cannot compare or sort `DateTimeOffset`, and I sort documents by date, so the context stores dates through a sortable value converter when the provider is SQLite. The data project exposes a single `AddUnifiedDocumentsData(connectionString)` extension method, so the entry project only calls that method and never references the database provider directly.

The connection string is just `Data Source=unified-documents.db` in `appsettings.json`, because there is no password to protect. I add `*.db` files to the `.gitignore` at the `src/` level, which I also need because `dotnet new classlib` does not create one and the data project's `obj/` folder almost got committed.

Then I generate the migration with the CLI instead of writing it by hand, and apply it. Creating the database needs no server:
```bash
dotnet ef migrations add InitialCreate --project UnifiedDocuments.Data --startup-project UnifiedDocuments --output-dir Migrations
cd UnifiedDocuments
dotnet ef database update --project ../UnifiedDocuments.Data
```

Now that there is somewhere to store the index, I need something to fill it: the background sync. Same approach as the data layer: a separate class library that the entry project registers with one extension method, `AddUnifiedDocumentsSync(configuration)`. The entry project only hosts it.
```bash
dotnet new classlib --name UnifiedDocuments.Sync
dotnet add UnifiedDocuments.Sync reference UnifiedDocuments.Data/UnifiedDocuments.Data.csproj
dotnet add UnifiedDocuments.Sync package Microsoft.Extensions.Hosting.Abstractions
dotnet add UnifiedDocuments.Sync package Microsoft.Extensions.Http.Resilience
dotnet add UnifiedDocuments.Sync package PdfPig
dotnet add UnifiedDocuments.Sync package MimeKit
dotnet add UnifiedDocuments reference UnifiedDocuments.Sync/UnifiedDocuments.Sync.csproj
```
Why a background service and not a separate console job or a scheduled task? The tool runs locally as one process, so the simplest thing is that the API itself keeps the index fresh: start the app, and it syncs right away and then every `Sync:Interval` (15 minutes by default). If the sync ever needs to run on its own, the library can be hosted by a worker project instead, without changes.

Why does the sync library talk to the `DbContext` directly instead of through a repository interface? Same reasoning as before: it is small, and there is one database implementation. `IDocumentSource` is different. It already has three real implementations, one per dealership system, so that is where the abstraction pays off:
- `SalesDocumentSource` pages with `page`/`pageSize`, and the business key is the deal number.
- `ServiceDocumentSource` follows the `links.next` URL, reads snake_case JSON, and the business key is the document kind.
- `WarrantyDocumentSource` sends a `POST` search and follows the opaque `NextPageToken`. The business key is the claim number.

I tested the substitution point with a fake `IDocumentSource` and an in-memory SQLite database. The test syncs a made-up repair order, then checks that its metadata and VIN link were indexed without starting any dealership API. This gives me a cheap way to test sync behavior independently from HTTP, credentials and each vendor's API. The existing source contract is enough for this boundary; I do not need a separate business project just to fake a document client.

Each source now has an `Enabled` setting under `DealershipSystems` in `appsettings.json`. I can set, for example, `DealershipSystems:Sales:Enabled` to `false` to keep that connector out of dependency injection. A disabled source does not need a URL or credentials, which is useful when I run only part of the local setup. Enabled sources validate their required settings at startup. The sync tests check both fake-client substitution and that disabled sources are not registered when credentials are absent.

Why hand-written clients instead of generating them from OpenAPI with Kiota or NSwag, as the design suggested? Each system has only two endpoints that I use, so a generator would add a tool and much more generated code than the connectors themselves. If the APIs grow, I would switch to generated clients.

Authentication is handled by `DelegatingHandler`s, so the connectors never deal with it. Sales and Service use a client-credentials token provider. It caches the token until shortly before it expires, and on a `401` it fetches a fresh token and retries once, because the mocks invalidate tokens when they restart. Warranty uses a Basic authentication handler. On top of that, `AddStandardResilienceHandler` retries temporary failures and waits for `Retry-After` on `429`. I raised its total timeout, because the default 30 seconds is shorter than the one-minute rate-limit window of the mocks.

For each source, the synchronizer:
1. Lists every document through the connector.
2. Skips the download if the source's modification time has not changed. Warranty exposes no modification time, so its documents are always downloaded and the content hash decides.
3. Otherwise downloads the content into memory only, hashes it, and if the hash changed, extracts the text and detects VINs. PDFs go through PdfPig, emails through MimeKit, and everything else is read as text. If parsing fails, the raw bytes are scanned instead, which still finds plain-text VINs.
4. Removes documents that were not seen in this run, but only after the full listing succeeded, so a failed sync never deletes anything.

A failure in one system is logged and does not stop the others or crash the host. The next run tries again.

The VIN detector matches 17 characters without `I`, `O` and `Q`, with at least one letter and one digit. It does not require a valid check digit, because most non-North-American VINs do not use one.

The source URLs and the mock credentials go into `appsettings.json` under `DealershipSystems`. They are the same mock values the dealership systems publish; for real systems they would come from environment variables or user secrets.

To check it, I start the three dealership systems and then the API. The first run adds all 18 documents. The next run finds them unchanged. Searching for `1HGCM82633A004352` returns 10 documents across all three systems, and the documents without a VIN are kept as unlinked.

### Adding another document provider later

Google Drive, Seafile, a network share or another document store can plug in as another `IDocumentSource`. I would keep each provider's API, authentication and paging inside its own adapter; `DocumentSynchronizer` should continue to see the same normalized listing and content stream. The provider needs to supply:
- a stable `SourceName` and opaque document ID (do not use a filename as an ID unless the provider guarantees it is unique and stable);
- `ListAllAsync` that handles the provider's pagination, returns filename, content type, business key and modification time where available, and honors cancellation;
- `OpenAsync` that fetches the original content as a stream, without saving a second copy into ProjectLoop;
- the provider's authentication, scopes/permissions, rate-limit behavior and retry rules, isolated in its adapter and HTTP handlers.

For Google Drive, I would decide which drives/folders ProjectLoop may index and use the supported Google authentication flow for that deployment; the adapter would keep Drive file IDs and map Drive metadata into `ListedDocument`. For Seafile, I would similarly choose the allowed libraries and map its stable file reference, path/name and timestamps. A local filesystem adapter could enumerate an explicitly configured root and use paths relative to that root as IDs. These are integration directions, not implemented providers. Each new provider should have fake-source sync tests like this one, plus focused adapter tests for its pagination, authentication and error behavior. If a provider cannot report a modification time, the current sync downloads it again and compares the content hash.

### First user story: list documents by VIN

I implemented the first story against the index instead of calling the dealership APIs from the browser. `GET /vehicles/{vin}/documents` validates a full VIN, finds its linked index rows and returns the filename, source system, business reference and modification time. The query stays local to SQLite; it does not fetch document bytes. I allow loopback browser origins so the separate EMFc app can call the local API without exposing dealership credentials.

The search response is marked `Cache-Control: private, max-age=60`. I hash the serialized response into an `ETag` and return `304 Not Modified` when the browser revalidates the same result, so the browser can reuse a recent result without allowing shared caches to retain it.

In EMFc's `app-car-documents` entry, I replaced the unrelated service monitor with a VIN search and a consolidated result table. It has inline VIN validation, loading, error and empty states, shows the source for every result, adapts the table rows for small screens, and credits eldervibe.dev for UI inspiration. I added short entrance and stagger motion inspired by Animate UI's interaction patterns, using CSS so it remains compatible with this Angular app, and disabled those animations for reduced-motion preferences.

To verify the story, I built both projects and searched `1HGCM82633A004352` in the browser. The UI showed 10 documents from Sales, Service and Warranty; an invalid VIN was rejected, a valid VIN with no indexed matches showed the empty state, and the mobile layout had no horizontal overflow.
