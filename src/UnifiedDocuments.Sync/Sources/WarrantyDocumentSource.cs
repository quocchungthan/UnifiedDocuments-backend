using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using UnifiedDocuments.Sync.Sources.Contracts;

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
            var result = await SearchPageAsync(pageToken, cancellationToken);

            // Warranty exposes no modification time, so ModifiedAt stays null and the content hash decides.
            foreach (var item in result.Documents)
                yield return ToListedDocument(item);

            pageToken = result.NextPageToken;
        }
        while (pageToken is not null);
    }

    public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
        http.GetStreamAsync($"warranty/v1/documents/{Uri.EscapeDataString(sourceDocumentId)}", cancellationToken);

    private async Task<WarrantySearchResponse> SearchPageAsync(string? pageToken, CancellationToken cancellationToken)
    {
        using var response = await http.PostAsJsonAsync(
            "warranty/v1/claims/documents/search",
            new WarrantySearchRequest(null, pageToken, MaxResults),
            Json,
            cancellationToken);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<WarrantySearchResponse>(Json, cancellationToken)
            ?? throw new InvalidOperationException("Warranty returned an empty page.");
    }

    private static ListedDocument ToListedDocument(WarrantyItem item) =>
        new(item.Id, item.FileName, item.MediaType, item.ClaimNumber, null);
}
