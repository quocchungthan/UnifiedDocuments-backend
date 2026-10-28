using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentContentEndpointTests
{
    [Theory]
    [InlineData(false, "inline")]
    [InlineData(true, "attachment")]
    public async Task GetContent_returns_original_bytes_and_expected_disposition(bool download, string disposition)
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
    [InlineData("\"hash\"", false)]
    [InlineData("W/\"hash\"", false)]
    [InlineData("*", false)]
    [InlineData("\"different\"", true)]
    public async Task GetContent_revalidates_before_opening_source(string tag, bool shouldFetch)
    {
        var content = Encoding.UTF8.GetBytes("original bytes");
        var document = DocumentApiFixture.Document("claim", content);
        document.ContentHash = "hash";
        await using var api = await DocumentApiFixture.CreateAsync(document);
        api.Source.Documents.Add("claim", content);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/documents/Warranty/claim/content");
        request.Headers.IfNoneMatch.Add(tag == "*" ? EntityTagHeaderValue.Any : EntityTagHeaderValue.Parse(tag));

        using var response = await api.Client.SendAsync(request);

        Assert.Equal(shouldFetch ? HttpStatusCode.OK : HttpStatusCode.NotModified, response.StatusCode);
        Assert.Equal(shouldFetch ? 1 : 0, api.Source.OpenCount);
    }

    [Theory]
    [InlineData(10 * 1024 * 1024, 1)]
    [InlineData(10 * 1024 * 1024 + 1, 2)]
    public async Task GetContent_caches_only_documents_at_or_below_the_size_limit(int size, int expectedFetches)
    {
        var content = new byte[size];
        Array.Fill(content, (byte)'x');
        await using var api = await DocumentApiFixture.CreateAsync(DocumentApiFixture.Document("claim", content));
        api.Source.Documents.Add("claim", content);

        using var first = await api.Client.GetAsync("/documents/Warranty/claim/content");
        using var second = await api.Client.GetAsync("/documents/Warranty/claim/content?download=true");

        Assert.Equal(content, await first.Content.ReadAsByteArrayAsync());
        Assert.Equal(content, await second.Content.ReadAsByteArrayAsync());
        Assert.Equal(expectedFetches, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("unknown", "Warranty")]
    [InlineData("claim", "Disabled")]
    public async Task GetContent_returns_not_found_for_unknown_documents_or_disabled_sources(string id, string source)
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
    public async Task GetContent_downloads_active_formats_instead_of_rendering_them(string contentType)
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
