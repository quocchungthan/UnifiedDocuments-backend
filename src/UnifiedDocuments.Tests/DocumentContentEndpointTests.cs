using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace UnifiedDocuments.Tests;

public sealed class DocumentContentEndpointTests
{
    [Theory]
    [InlineData(false, "inline")]
    [InlineData(true, "attachment")]
    public async Task GetContent_DownloadFlag_ReturnsOriginalBytesWithRequestedDispositionAndCacheHeadersAsync(bool download, string disposition)
    {
        var content = Encoding.UTF8.GetBytes("PDF bytes for 1HGCM82633A004352");
        var document = DocumentApiFixture.Document("claim form", content);
        await using var api = await DocumentApiFixture.CreateAsync(document);
        api.Source.Documents.Add(document.SourceDocumentId, content);

        using var response = await api.Client.GetAsync($"/documents/Warranty/claim%20form/content?download={download}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(disposition, response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Contains("claim%20form.pdf", response.Content.Headers.GetValues("Content-Disposition").Single());
        Assert.True(response.Headers.CacheControl?.Private);
        Assert.Equal(TimeSpan.FromMinutes(15), response.Headers.CacheControl?.MaxAge);
        Assert.Equal(content, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal($"\"{document.ContentHash}\"", response.Headers.ETag?.Tag);
        Assert.Equal(1, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("matching", false)]
    [InlineData("weak", false)]
    [InlineData("wildcard", false)]
    [InlineData("different", true)]
    public async Task GetContent_ConditionalRequestForCachedBytes_ReturnsNotModifiedOnlyForMatchingTagsWithoutRefetchingAsync(string tagKind, bool shouldFetch)
    {
        var content = Encoding.UTF8.GetBytes("original bytes");
        var document = DocumentApiFixture.Document("claim", content);
        await using var api = await DocumentApiFixture.CreateAsync(document);
        api.Source.Documents.Add("claim", content);
        using var initial = await api.Client.GetAsync("/documents/Warranty/claim/content");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/documents/Warranty/claim/content");
        var tag = tagKind switch
        {
            "matching" => $"\"{document.ContentHash}\"",
            "weak" => $"W/\"{document.ContentHash}\"",
            "wildcard" => "*",
            _ => "\"different\"",
        };
        request.Headers.IfNoneMatch.Add(tag == "*" ? EntityTagHeaderValue.Any : EntityTagHeaderValue.Parse(tag));

        using var response = await api.Client.SendAsync(request);

        Assert.Equal(shouldFetch ? HttpStatusCode.OK : HttpStatusCode.NotModified, response.StatusCode);
        Assert.Equal(1, api.Source.OpenCount);
    }

    [Fact]
    public async Task GetContent_StaleIndexHash_UsesDownloadedBytesHashForETagAndRevalidationAsync()
    {
        var indexedContent = Encoding.UTF8.GetBytes("indexed bytes");
        var currentContent = Encoding.UTF8.GetBytes("current upstream bytes");
        var document = DocumentApiFixture.Document("claim", indexedContent);
        await using var api = await DocumentApiFixture.CreateAsync(document);
        api.Source.Documents.Add("claim", currentContent);

        using var first = await api.Client.GetAsync("/documents/Warranty/claim/content");

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(currentContent, await first.Content.ReadAsByteArrayAsync());
        var actualTag = $"\"{Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(currentContent))}\"";
        Assert.Equal(actualTag, first.Headers.ETag?.Tag);

        using var staleRequest = new HttpRequestMessage(HttpMethod.Get, "/documents/Warranty/claim/content");
        staleRequest.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Parse($"\"{document.ContentHash}\""));
        using var staleResponse = await api.Client.SendAsync(staleRequest);
        Assert.Equal(HttpStatusCode.OK, staleResponse.StatusCode);
        Assert.Equal(currentContent, await staleResponse.Content.ReadAsByteArrayAsync());

        using var currentRequest = new HttpRequestMessage(HttpMethod.Get, "/documents/Warranty/claim/content");
        currentRequest.Headers.IfNoneMatch.Add(EntityTagHeaderValue.Parse(actualTag));
        using var currentResponse = await api.Client.SendAsync(currentRequest);
        Assert.Equal(HttpStatusCode.NotModified, currentResponse.StatusCode);
        Assert.Equal(1, api.Source.OpenCount);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.ServiceUnavailable, HttpStatusCode.ServiceUnavailable)]
    public async Task GetContent_UpstreamNotFoundOrServiceUnavailable_ReturnsCorrespondingHttpStatusAsync(HttpStatusCode upstreamStatus, HttpStatusCode expectedStatus)
    {
        var document = DocumentApiFixture.Document("claim", []);
        await using var api = await DocumentApiFixture.CreateAsync(document);
        api.Source.OpenException = new HttpRequestException("upstream failure", null, upstreamStatus);

        using var response = await api.Client.GetAsync("/documents/Warranty/claim/content");

        Assert.Equal(expectedStatus, response.StatusCode);
    }

    [Theory]
    [InlineData(10 * 1024 * 1024, 1, true)]
    [InlineData(10 * 1024 * 1024 + 1, 2, false)]
    public async Task GetContent_DocumentAtOrAboveCacheSizeLimit_CachesAndSetsETagOnlyWithinLimitAsync(int size, int expectedFetches, bool hasEtag)
    {
        var content = new byte[size];
        Array.Fill(content, (byte)'x');
        await using var api = await DocumentApiFixture.CreateAsync(DocumentApiFixture.Document("claim", content));
        api.Source.Documents.Add("claim", content);

        using var first = await api.Client.GetAsync("/documents/Warranty/claim/content");
        using var second = await api.Client.GetAsync("/documents/Warranty/claim/content?download=true");

        Assert.Equal(content, await first.Content.ReadAsByteArrayAsync());
        Assert.Equal(content, await second.Content.ReadAsByteArrayAsync());
        Assert.Equal(hasEtag, first.Headers.ETag is not null);
        Assert.Equal(hasEtag, second.Headers.ETag is not null);
        Assert.Equal(expectedFetches, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("unknown", "Warranty")]
    [InlineData("claim", "Disabled")]
    public async Task GetContent_UnknownDocumentOrDisabledSource_ReturnsNotFoundWithoutFetchingContentAsync(string id, string source)
    {
        await using var api = await DocumentApiFixture.CreateAsync(
            DocumentApiFixture.Document("claim", [], source: "Disabled"));

        using var response = await api.Client.GetAsync($"/documents/{source}/{id}/content");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("text/html")]
    [InlineData("image/svg+xml")]
    [InlineData("application/json")]
    public async Task GetContent_ActiveContentType_ReturnsAttachmentWithNoSniffHeaderAsync(string contentType)
    {
        byte[] content = [1, 2, 3];
        await using var api = await DocumentApiFixture.CreateAsync(
            DocumentApiFixture.Document("claim", content, contentType));
        api.Source.Documents.Add("claim", content);

        using var response = await api.Client.GetAsync("/documents/Warranty/claim/content");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("attachment", response.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
    }
}