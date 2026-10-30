namespace UnifiedDocuments.Sync.Sources;

// One implementation per dealership system; hides its paging, schema and authentication.
public interface IDocumentSource
{
    string SourceName { get; }
    IAsyncEnumerable<ListedDocument> ListAllAsync(CancellationToken cancellationToken);
    Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken);
}
