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
