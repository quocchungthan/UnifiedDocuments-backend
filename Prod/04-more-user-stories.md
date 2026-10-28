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
