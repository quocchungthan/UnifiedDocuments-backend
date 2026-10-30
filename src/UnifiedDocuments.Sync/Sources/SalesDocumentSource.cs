using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using UnifiedDocuments.Sync.Sources.Contracts;

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
            var result = await GetPageAsync(page, cancellationToken);

            foreach (var item in result.Items)
                yield return ToListedDocument(item);

            if (page >= result.TotalPages)
                yield break;
        }
    }

    public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
        http.GetStreamAsync($"api/v1/documents/{Uri.EscapeDataString(sourceDocumentId)}/content", cancellationToken);

    private async Task<SalesPage> GetPageAsync(int page, CancellationToken cancellationToken) =>
        await http.GetFromJsonAsync<SalesPage>($"api/v1/documents?page={page}&pageSize={PageSize}", cancellationToken)
            ?? throw new InvalidOperationException("Sales returned an empty page.");

    private static ListedDocument ToListedDocument(SalesItem item) =>
        new(item.DocumentId, item.FileName, item.ContentType, item.DealNumber, item.LastModifiedUtc);
}
