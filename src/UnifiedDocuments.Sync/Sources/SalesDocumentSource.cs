using System.Net.Http.Json;
using System.Runtime.CompilerServices;

namespace UnifiedDocuments.Sync.Sources;

// Sales: page/pageSize paging, camelCase JSON, grouped by deal.
public sealed class SalesDocumentSource(HttpClient http) : IDocumentSource
{
    private const int PageSize = 100;

    public string SourceName => "Sales";

    public async IAsyncEnumerable<ListedDocument> ListAllAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        for (var page = 1; ; page++)
        {
            var result = await http.GetFromJsonAsync<SalesPage>($"api/v1/documents?page={page}&pageSize={PageSize}", cancellationToken)
                ?? throw new InvalidOperationException("Sales returned an empty page.");

            foreach (var item in result.Items)
                yield return new ListedDocument(item.DocumentId, item.FileName, item.ContentType, item.DealNumber, item.LastModifiedUtc);

            if (page >= result.TotalPages)
                yield break;
        }
    }

    public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
        http.GetStreamAsync($"api/v1/documents/{Uri.EscapeDataString(sourceDocumentId)}/content", cancellationToken);

    private sealed record SalesPage(int TotalPages, List<SalesItem> Items);

    private sealed record SalesItem(string DocumentId, string? DealNumber, string FileName, string ContentType, DateTimeOffset LastModifiedUtc);
}
