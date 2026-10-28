using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();

var documentsRoot = Path.Combine(app.Environment.ContentRootPath, "Documents");
var contentTypes = new FileExtensionContentTypeProvider();

app.MapGet("/api/v1/documents", (int? page, int? pageSize) =>
{
    var pageNumber = page ?? 1;
    var size = pageSize ?? 20;
    if (pageNumber < 1 || size is < 1 or > 100)
        return Results.Problem("page must be >= 1 and pageSize must be between 1 and 100.", statusCode: StatusCodes.Status400BadRequest);

    var files = ListFiles();
    var skip = (int)Math.Min((long)(pageNumber - 1) * size, files.Count);
    var items = files.Skip(skip).Take(size).Select(ToDocument).ToList();

    return Results.Ok(new SalesDocumentPage(
        pageNumber,
        size,
        files.Count,
        (int)Math.Ceiling(files.Count / (double)size),
        items));
})
.WithName("ListDocuments")
.WithTags("Documents")
.Produces<SalesDocumentPage>()
.ProducesProblem(StatusCodes.Status400BadRequest);

app.MapGet("/api/v1/documents/{documentId}/content", (string documentId) =>
{
    var file = ListFiles().FirstOrDefault(f => DocumentId(f) == documentId);
    return file is null
        ? Results.NotFound()
        : Results.File(file, ContentType(file), Path.GetFileName(file));
})
.WithName("DownloadDocument")
.WithTags("Documents")
.Produces(StatusCodes.Status200OK, contentType: "application/octet-stream")
.Produces(StatusCodes.Status404NotFound);

app.Run();

// Ordinal ordering keeps paging stable across requests.
List<string> ListFiles() =>
    Directory.Exists(documentsRoot)
        ? Directory.EnumerateFiles(documentsRoot, "*", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList()
        : [];

string RelativePath(string file) =>
    Path.GetRelativePath(documentsRoot, file).Replace('\\', '/');

string DocumentId(string file) =>
    Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(RelativePath(file))))[..16];

string ContentType(string file) =>
    contentTypes.TryGetContentType(file, out var type) ? type : "application/octet-stream";

SalesDocument ToDocument(string file)
{
    var info = new FileInfo(file);
    var segments = RelativePath(file).Split('/');
    var id = DocumentId(file);

    return new SalesDocument(
        id,
        segments.Length > 1 ? segments[0] : null,
        segments.Length > 2 ? segments[1] : "general",
        info.Name,
        ContentType(file),
        info.Length,
        info.LastWriteTimeUtc,
        $"/api/v1/documents/{id}/content");
}

record SalesDocument(
    string DocumentId,
    string? DealNumber,
    string Category,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset LastModifiedUtc,
    string DownloadUrl);

record SalesDocumentPage(
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    IReadOnlyList<SalesDocument> Items);
