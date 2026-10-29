# 04 - More User Stories

The first user story, listing documents by VIN, is implemented in
[03](./03-implementation-steps.md). Here is the second story: the user wants to
read a document, for example to download or print it.

The user clicks **View / print** or **Download** in the search results. The
browser asks our API for the document by its source name and ID. The API looks
up the record in the index, then asks the matching dealership connector for the
original content. The browser never talks to a dealership API directly, and it
never receives dealership credentials.

For viewing, I let the browser render PDFs and common image formats inline. The
browser's PDF viewer already provides printing, so there is no need to build a
separate print feature. Other formats are downloaded instead of rendered in the
API's origin. The download link asks the API for an attachment, using the
indexed filename.

The response carries the content hash as its `ETag`. When the browser asks for
the same document again with `If-None-Match`, the API can return `304 Not
Modified` without fetching the content from the dealership system. The response
is private, not shared with a proxy or CDN. I cache documents in backend memory
for 15 minutes, with a 64 MiB total cache limit. A document larger than 10 MiB
is streamed without backend memory caching. The cache duration is one constant
in the endpoint, used for both the memory-cache expiration and HTTP `max-age`.

The API only returns a document that exists in the index and whose source
connector is enabled. It does not write document bytes to the database or to
frontend storage.

While adding document-specific behavior, I noticed that text extraction had
also started to collect format handling in one switch. The Boy Scout Rule
applies here: leave that code easier to extend than we found it. PDF and email
need their own parsers, while HTML, CSV, TXT, JSON, XML, SVG and Markdown can
share UTF-8 text handling. I moved those behaviors into extraction strategies,
with malformed-file fallback staying in the coordinator. This gives a new
format a focused place for its parser without creating a separate class for
every extension that uses the same text behavior.

Why use Strategy instead of adding more cases to the switch? The formats that
need real parsing have different dependencies and failure modes: PDF uses
PdfPig, email uses MimeKit, and text-like formats can be scanned as UTF-8. A
strategy keeps each format's parsing rule in one small implementation and lets
the extractor select it by media type. Adding another special format then
means adding and registering a handler, rather than enlarging the coordinator
and mixing parser details into it. Formats with the same simple behavior still
share one text strategy, so this is not one class per file extension. The
coordinator remains responsible for the common fallback: if a parser rejects
malformed content, it logs the failure and scans the raw bytes for VINs.

The strategies are registered as singletons because they are stateless: they
keep no document bytes, per-call parser state or request-specific data between
calls. Each `Extract` call creates and disposes its own parser resources, so
reuse of the strategy objects does not share a live PDF or email parser across
documents. Transient registrations would create new, identical strategy
objects for each dependency resolution without improving isolation. The
extractor is also a singleton for the same reason. The synchronizer stays
scoped because it works with the scoped EF Core `DbContext`, while dealership
connectors are transient typed HTTP clients managed by `IHttpClientFactory`.
Those different lifetimes follow their state and resource ownership rather
than applying one lifetime to every service.

> In short keep the implementation: Encapsulated, Functional, Managable and contract-firsts is the princple when I work with AI for easier to control the outcome, I call it EMFc for short.

The same Boy Scout Rule applies to the frontend. The Vehicle Documents logo
and brand are one home link to `/`. Clicking either returns to a fresh search
page and removes the VIN query and any other URL parameters. A normal link
already provides keyboard navigation and browser history, so this does not
need another click handler or state-reset mechanism. And tiny further enhancements are coming.

Before starting the last story, I stopped the running backend and checked the
tests against Arrange, Act, Assert. The sync and extraction tests already
separate their setup, action and expected result. The content endpoint test
was doing several different scenarios in one method, though. I split those
into focused cases and kept the local API, SQLite and fake-source setup in
one disposable test helper. The tests still exercise the actual HTTP routes,
not a second implementation of their logic.

I also added cases around the behavior we could easily miss: weak and wildcard
ETags must avoid opening the source, disabled sources must not serve content,
active formats must download, and exactly 10 MiB is cacheable while 10 MiB
plus one byte is not. This is the Boy Scout Rule applied to the test suite:
make failures easier to explain before extending the next behavior.

Now the third and last story is reviewing documents where no VIN was found.
No detected VIN does not mean the document is invalid or should disappear.
It can still be useful to the team, so sync keeps its metadata in the index
without a VIN link. This story lists those records for review; it does not
add manual VIN assignment or change the source document.

The contract is `GET /documents/unlinked?cursor=...&pageSize=50`. It reads indexed records whose VIN
links are empty, without calling any dealership system. Documents with one
or several detected VINs are excluded. There is no new external-system
contract or database schema needed here: the existing metadata and VIN links
already answer the question.

Unlinked documents can be a large set, so this endpoint must not return every
record in one response. It returns `{ items, nextCursor }`, with 50 records by
default and a maximum page size of 100. A null cursor means the end. Invalid
page sizes and cursors return an explicit validation error.

I reuse the same metadata fields, private 60-second cache headers and response
ETag calculation as the VIN query. For unlinked pages, ordering is descending
by modified date, falling back to indexed date, then by the unique index row
ID. The opaque cursor carries the last date and row ID. This is keyset paging:
the next query continues below that pair rather than skipping an increasing
offset or counting the whole result set. Equal-date rows are not lost between
pages. The existing VIN response remains an array.

This is a live index, not a frozen export. Sync can add, remove or reclassify
documents while someone reviews it. Newer or changed rows above the cursor
are picked up on a fresh review; the UI also avoids appending a duplicate
source/document identity if a changed row reappears below it.

On the frontend, **Review unlinked documents** loads that endpoint without
requiring a VIN. The URL becomes `/?view=unlinked`, so a reload or shared link
opens the same view from its first page. The heading and empty state explain that no VIN was
detected, and errors stay visible with a retry of the same query. VIN search
returns to the normal results mode, while the brand link still goes home to
`/`. Loading and error handling are shared instead of duplicated.

The list reuses the existing source-labelled table and responsive View / print
and Download actions. Both actions still point at our backend content proxy,
not the dealership APIs. English and Vietnamese messages cover the new view.

The added tests cover unlinked inclusion, linked and multi-VIN exclusion,
empty results, metadata, deterministic date ordering and conditional HTTP
responses, alongside VIN-query regression cases. A sync case also checks that
a document without a VIN really remains indexed. Frontend tests cover the
backend URL and contract, unlinked loading, direct-link restoration, empty
and error states, retry, duplicate-request protection and returning to VIN
search.

The list loads another page when its bottom sentinel approaches the viewport.
An IntersectionObserver is disconnected when its view changes or the component
is destroyed. Requests are guarded so repeated scroll notifications cannot
start duplicate loads. The table stays on screen while the next page loads,
and the count says how many documents are loaded, not an invented total.
A Load more button provides a keyboard-accessible alternative and still works
if IntersectionObserver is unavailable. If a later page fails, the existing
rows and cursor stay intact, automatic loading pauses, and Retry requests that
same page. A null next cursor stops scrolling requests and shows the end state.

The paging tests walk a set larger than two default pages, including equal
dates, and verify bounded responses, no missing or duplicate rows, cursor
validation and termination. Frontend cases check append, end-of-list,
duplicate-request protection and preserving rows when a page must be retried.


### Containerized local setup

The root `compose.yaml` builds each dealership mock and the backend from the
shared .NET 10 `Dockerfile`. The frontend workflow artifact from run 40723162028
is pinned in `frontend-bundle/` and copied into the backend image at build time.
Compose gives the containers service-name URLs, waits for all three mocks to be
healthy before starting the backend, and stores the SQLite index in a named
volume. The backend applies its EF migrations at startup. Host ports, the local
hostname and mock credentials are supplied through `.env`; add the hostname to
the Windows hosts file to browse the app as `unified.documents.local`.

Let's say for usability and testability, we need to introduce a lazyload list of index VIN in the searchbox when user start typing there, we order them by best match first. Let's called the Endpoints extension VehicleIdentifierNumbersEndpoints, we also need to adapt the frontend in EMFc angular UI to loading when user focus at the box, also, adopt the abortion when user continue typing while requests on flight.