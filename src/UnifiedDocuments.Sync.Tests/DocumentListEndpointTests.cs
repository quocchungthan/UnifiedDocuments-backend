using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentListEndpointTests
{
    [Fact]
    public async Task GetUnlinked_returns_only_documents_without_vin_links_in_date_order()
    {
        var linked = DocumentApiFixture.Document("linked", [], vin: "1HGCM82633A004352", day: 3);
        linked.Vins.Add(new() { Vin = "3DDDDDDDDDDDDDDDD" });
        await using var api = await DocumentApiFixture.CreateAsync(
            DocumentApiFixture.Document("older", [], day: 1),
            linked,
            DocumentApiFixture.Document("newer", [], source: "Service", day: 2));

        using var response = await api.Client.GetAsync("/documents/unlinked");
        var page = await response.Content.ReadFromJsonAsync<DocumentPage>();
        var documents = page?.Items;

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(documents);
        Assert.Equal(["newer", "older"], documents.Select(document => document.GetProperty("sourceDocumentId").GetString()));
        Assert.Equal("Service", documents[0].GetProperty("sourceName").GetString());
        Assert.Equal("newer.pdf", documents[0].GetProperty("fileName").GetString());
        Assert.Equal("application/pdf", documents[0].GetProperty("contentType").GetString());
        Assert.Equal("WC-2025-0001", documents[0].GetProperty("businessKey").GetString());
        Assert.Equal(JsonValueKind.Null, documents[0].GetProperty("modifiedAt").ValueKind);
        Assert.Equal(6, documents[0].EnumerateObject().Count());
        Assert.Null(page!.NextCursor);
        Assert.Equal(0, api.Source.OpenCount);
    }

    [Fact]
    public async Task GetUnlinked_sorts_by_modified_date_then_unique_id_for_stable_results()
    {
        var recentlyIndexed = DocumentApiFixture.Document("old-modification", [], day: 5);
        recentlyIndexed.ModifiedAt = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero);
        await using var api = await DocumentApiFixture.CreateAsync(
            recentlyIndexed,
            DocumentApiFixture.Document("z", [], source: "Sales", day: 2),
            DocumentApiFixture.Document("b", [], source: "Service", day: 2),
            DocumentApiFixture.Document("a", [], source: "Service", day: 2));

        var page = await api.Client.GetFromJsonAsync<DocumentPage>("/documents/unlinked");
        var documents = page?.Items;

        Assert.NotNull(documents);
        Assert.Equal(["a", "b", "z", "old-modification"],
            documents.Select(document => document.GetProperty("sourceDocumentId").GetString()));
    }

    [Theory]
    [InlineData("/documents/unlinked")]
    [InlineData("/vehicles/1HGCM82633A004352/documents")]
    public async Task GetList_returns_no_items_when_no_documents_match(string path)
    {
        await using var api = await DocumentApiFixture.CreateAsync();

        var body = await api.Client.GetFromJsonAsync<JsonElement>(path);
        var documents = path == "/documents/unlinked" ? body.GetProperty("items") : body;

        Assert.Equal(0, documents.GetArrayLength());
        Assert.Equal(0, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("", 50)]
    [InlineData("?pageSize=100", 100)]
    public async Task GetUnlinked_bounds_each_page_and_covers_equal_date_rows_without_duplicates(string query, int expectedSize)
    {
        var documents = Enumerable.Range(1, 123)
            .Select(index => DocumentApiFixture.Document($"doc-{index}", [], day: index % 3 + 1))
            .ToArray();
        await using var api = await DocumentApiFixture.CreateAsync(documents);

        var pages = new List<DocumentPage>();
        var path = "/documents/unlinked" + query;
        do
        {
            var page = await api.Client.GetFromJsonAsync<DocumentPage>(path);
            Assert.NotNull(page);
            pages.Add(page);
            path = $"/documents/unlinked?pageSize={expectedSize}&cursor={Uri.EscapeDataString(page.NextCursor ?? "")}";
        } while (pages[^1].NextCursor is not null && pages.Count < 10);

        Assert.Equal(expectedSize, pages[0].Items.Length);
        Assert.All(pages, page => Assert.InRange(page.Items.Length, 1, expectedSize));
        Assert.Null(pages[^1].NextCursor);
        var ids = pages.SelectMany(page => page.Items)
            .Select(document => document.GetProperty("sourceDocumentId").GetString()).ToArray();
        Assert.Equal(123, ids.Length);
        Assert.Equal(123, ids.Distinct().Count());
        Assert.Equal(0, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("?pageSize=0")]
    [InlineData("?pageSize=101")]
    [InlineData("?cursor=")]
    [InlineData("?cursor=not-a-cursor")]
    [InlineData("?cursor=bnVsbA")]
    public async Task GetUnlinked_rejects_invalid_paging_values_with_a_message(string query)
    {
        await using var api = await DocumentApiFixture.CreateAsync();

        using var response = await api.Client.GetAsync("/documents/unlinked" + query);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
    }

    [Theory]
    [InlineData("/documents/unlinked")]
    [InlineData("/vehicles/1HGCM82633A004352/documents")]
    public async Task GetList_revalidates_unchanged_results_with_private_cache_headers(string path)
    {
        await using var api = await DocumentApiFixture.CreateAsync(
            DocumentApiFixture.Document("claim", [], vin: "1HGCM82633A004352"));
        using var original = await api.Client.GetAsync(path);
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.IfNoneMatch.Add(original.Headers.ETag!);

        using var response = await api.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NotModified, response.StatusCode);
        Assert.True(response.Headers.CacheControl?.Private);
        Assert.Equal(TimeSpan.FromSeconds(60), response.Headers.CacheControl?.MaxAge);
        Assert.Equal(original.Headers.ETag, response.Headers.ETag);
        Assert.Empty(await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task GetByVin_excludes_unlinked_and_other_vehicle_documents()
    {
        await using var api = await DocumentApiFixture.CreateAsync(
            DocumentApiFixture.Document("match", [], vin: "1HGCM82633A004352"),
            DocumentApiFixture.Document("other", [], vin: "3DDDDDDDDDDDDDDDD"),
            DocumentApiFixture.Document("unlinked", []));

        var documents = await api.Client.GetFromJsonAsync<JsonElement[]>("/vehicles/1hgcm82633a004352/documents");

        Assert.NotNull(documents);
        Assert.Equal("match", Assert.Single(documents).GetProperty("sourceDocumentId").GetString());
        Assert.Equal(0, api.Source.OpenCount);
    }

    [Theory]
    [InlineData("short")]
    [InlineData("IIIIIIIIIIIIIIIII")]
    [InlineData("12345678901234567")]
    public async Task GetByVin_rejects_invalid_vin_with_a_validation_message(string vin)
    {
        await using var api = await DocumentApiFixture.CreateAsync();

        using var response = await api.Client.GetAsync($"/vehicles/{vin}/documents");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace(body.GetProperty("message").GetString()));
    }

    private sealed record DocumentPage(JsonElement[] Items, string? NextCursor);
}
