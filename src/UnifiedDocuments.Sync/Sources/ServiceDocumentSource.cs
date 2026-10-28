using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace UnifiedDocuments.Sync.Sources;

// Service: offset/limit paging with a "next" link, snake_case JSON, grouped by document kind.
public sealed class ServiceDocumentSource(HttpClient http) : IDocumentSource
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
    };

    public string SourceName => "Service";

    public async IAsyncEnumerable<ListedDocument> ListAllAsync([EnumeratorCancellation] CancellationToken cancellationToken)
    {
        string? next = "service-api/v2/documents?offset=0&limit=50";
        while (next is not null)
        {
            var result = await http.GetFromJsonAsync<ServicePage>(next.TrimStart('/'), Json, cancellationToken)
                ?? throw new InvalidOperationException("Service returned an empty page.");

            foreach (var item in result.Data)
                yield return new ListedDocument(item.RecordId, item.FileName, item.MimeType, item.DocumentKind, item.UploadedAt);

            next = result.Links.Next;
        }
    }

    public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
        http.GetStreamAsync($"service-api/v2/documents/{Uri.EscapeDataString(sourceDocumentId)}/file", cancellationToken);

    private sealed record ServicePage(List<ServiceItem> Data, ServiceLinks Links);

    private sealed record ServiceItem(string RecordId, string DocumentKind, string FileName, string MimeType, DateTimeOffset UploadedAt);

    private sealed record ServiceLinks(string? Next);
}
