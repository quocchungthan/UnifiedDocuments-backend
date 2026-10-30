namespace UnifiedDocuments.Sync.Sources;

public sealed record ListedDocument(
    string SourceDocumentId,
    string FileName,
    string ContentType,
    string? BusinessKey,
    DateTimeOffset? ModifiedAt);