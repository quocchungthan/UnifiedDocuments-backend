namespace UnifiedDocuments.Sync.Sources;

public sealed record ListedDocument(
    string SourceDocumentId,
    string FileName,
    string ContentType,
    string? BusinessKey,
    DateTimeOffset? ModifiedAt);

// One implementation per dealership system; hides its paging, schema and authentication.
public interface IDocumentSource
{
    string SourceName { get; }
    IAsyncEnumerable<ListedDocument> ListAllAsync(CancellationToken cancellationToken);
    Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken);
}
