using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentSourceTests
{
    [Theory]
    [InlineData("Sales")]
    [InlineData("Service")]
    [InlineData("Warranty")]
    public async Task ListAll_MultiplePages_ReturnsMappedDocumentsAndFollowsSourcePagingAsync(string sourceName)
    {
        var pageNumber = 0;
        using var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            pageNumber++;
            Assert.InRange(pageNumber, 1, 2);
            if (sourceName == "Warranty")
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.Equal("/warranty/v1/claims/documents/search", request.RequestUri?.PathAndQuery);
                var body = await request.Content!.ReadFromJsonAsync<JsonElement>(cancellationToken);
                Assert.Equal(30, body.GetProperty("MaxResults").GetInt32());
                Assert.Equal(JsonValueKind.Null, body.GetProperty("ClaimNumber").ValueKind);
                Assert.Equal(pageNumber == 1 ? null : "next/+ token=", body.GetProperty("PageToken").GetString());
                Assert.Equal(3, body.EnumerateObject().Count());
            }
            else
            {
                Assert.Equal(HttpMethod.Get, request.Method);
                var expectedPath = sourceName == "Sales"
                    ? $"/api/v1/documents?page={pageNumber}&pageSize=100"
                    : $"/service-api/v2/documents?offset={(pageNumber - 1) * 50}&limit=50";
                Assert.Equal(expectedPath, request.RequestUri?.PathAndQuery);
            }

            return StubHttpMessageHandler.JsonResponse(CreatePage(sourceName, pageNumber));
        });
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://source.test/") };
        var source = CreateSource(sourceName, http);
        var documents = await ReadDocumentsAsync(source);

        Assert.Equal(2, pageNumber);
        Assert.Equal(["doc-1", "doc-2"], documents.Select(document => document.SourceDocumentId));
        Assert.All(documents, document =>
        {
            Assert.Equal("sample.pdf", document.FileName);
            Assert.Equal("application/pdf", document.ContentType);
            Assert.Equal("business-42", document.BusinessKey);
            Assert.Equal(sourceName == "Warranty" ? (DateTimeOffset?)null : DateTimeOffset.Parse("2026-10-01T10:00:00Z"),
                document.ModifiedAt);
        });
    }

    [Theory]
    [InlineData("Sales")]
    [InlineData("Service")]
    [InlineData("Warranty")]
    public async Task ListAll_NullPage_ThrowsInvalidOperationExceptionAsync(string sourceName)
    {
        using var handler = new StubHttpMessageHandler((request, cancellationToken) =>
            Task.FromResult(StubHttpMessageHandler.JsonResponse("null")));
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://source.test/") };

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => ReadDocumentsAsync(CreateSource(sourceName, http)));

        Assert.Equal($"{sourceName} returned an empty page.", exception.Message);
    }

    [Theory]
    [InlineData("Sales")]
    [InlineData("Service")]
    [InlineData("Warranty")]
    public async Task ListAll_UpstreamUnavailable_ThrowsHttpRequestExceptionAsync(string sourceName)
    {
        using var handler = new StubHttpMessageHandler((request, cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)));
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://source.test/") };

        var exception = await Assert.ThrowsAsync<HttpRequestException>(() => ReadDocumentsAsync(CreateSource(sourceName, http)));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, exception.StatusCode);
    }

    [Theory]
    [InlineData("Sales", "api/v1/documents/{0}/content")]
    [InlineData("Service", "service-api/v2/documents/{0}/file")]
    [InlineData("Warranty", "warranty/v1/documents/{0}")]
    public async Task Open_DocumentIdContainsReservedCharacters_EncodesIdAndReturnsOriginalBytesAsync(string sourceName, string path)
    {
        const string documentId = "folder/claim ?#";
        var content = Encoding.UTF8.GetBytes("original document bytes");
        using var handler = new StubHttpMessageHandler((request, cancellationToken) =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("http://source.test/" + string.Format(path, Uri.EscapeDataString(documentId)), request.RequestUri?.AbsoluteUri);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(content) });
        });
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://source.test/") };

        await using var stream = await CreateSource(sourceName, http).OpenAsync(documentId, CancellationToken.None);
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer);

        Assert.Equal(content, buffer.ToArray());
    }

    private static IDocumentSource CreateSource(string sourceName, HttpClient http) => sourceName switch
    {
        "Sales" => new SalesDocumentSource(http),
        "Service" => new ServiceDocumentSource(http),
        "Warranty" => new WarrantyDocumentSource(http),
        _ => throw new ArgumentOutOfRangeException(nameof(sourceName)),
    };

    private static async Task<List<ListedDocument>> ReadDocumentsAsync(IDocumentSource source)
    {
        var documents = new List<ListedDocument>();
        await foreach (var document in source.ListAllAsync(CancellationToken.None))
            documents.Add(document);
        return documents;
    }

    private static string CreatePage(string sourceName, int pageNumber) => sourceName switch
    {
        "Sales" => JsonSerializer.Serialize(new
        {
            totalPages = 2,
            items = new[] { new { documentId = $"doc-{pageNumber}", dealNumber = "business-42", fileName = "sample.pdf",
                contentType = "application/pdf", lastModifiedUtc = "2026-10-01T10:00:00Z" } },
        }),
        "Service" => JsonSerializer.Serialize(new
        {
            data = new[] { new { record_id = $"doc-{pageNumber}", document_kind = "business-42", file_name = "sample.pdf",
                mime_type = "application/pdf", uploaded_at = "2026-10-01T10:00:00Z" } },
            links = new { next = pageNumber == 1 ? "/service-api/v2/documents?offset=50&limit=50" : null },
        }),
        "Warranty" => JsonSerializer.Serialize(new
        {
            Documents = new[] { new { Id = $"doc-{pageNumber}", ClaimNumber = "business-42", MediaType = "application/pdf", FileName = "sample.pdf" } },
            NextPageToken = pageNumber == 1 ? "next/+ token=" : null,
        }),
        _ => throw new ArgumentOutOfRangeException(nameof(sourceName)),
    };
}