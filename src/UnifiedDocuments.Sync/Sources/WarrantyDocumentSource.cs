using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace UnifiedDocuments.Sync.Sources;

// Warranty: POST search with an opaque page token, PascalCase JSON, grouped by claim.
public sealed class WarrantyDocumentSource(HttpClient http) : IDocumentSource
{
    private const int MaxResults = 30;
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = null };

    public string SourceName => "Warranty";

    public async IAsyncEnumerable<ListedDocument> ListAllAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        string? pageToken = null;
        do
        {
            using var response = await http.PostAsJsonAsync(
                "warranty/v1/claims/documents/search",
                new SearchRequest(null, pageToken, MaxResults),
                Json,
                cancellationToken);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<SearchResponse>(Json, cancellationToken)
                ?? throw new InvalidOperationException("Warranty returned an empty page.");

            // Warranty exposes no modification time, so ModifiedAt stays null and the content hash decides.
            foreach (var item in result.Documents)
                yield return new ListedDocument(item.Id, item.FileName, item.MediaType, item.ClaimNumber, null);

            pageToken = result.NextPageToken;
        }
        while (pageToken is not null);
    }

    public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
        http.GetStreamAsync($"warranty/v1/documents/{Uri.EscapeDataString(sourceDocumentId)}", cancellationToken);

    private sealed record SearchRequest(string? ClaimNumber, string? PageToken, int MaxResults);

    private sealed record SearchResponse(List<WarrantyItem> Documents, string? NextPageToken);

    private sealed record WarrantyItem(string Id, string ClaimNumber, string MediaType, string FileName);
}
