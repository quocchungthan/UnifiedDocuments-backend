namespace UnifiedDocuments.Contracts;

public sealed record DocumentMetadata(
    string SourceName,
    string SourceDocumentId,
    string FileName,
    string ContentType,
    string? BusinessKey,
    DateTimeOffset? ModifiedAt);