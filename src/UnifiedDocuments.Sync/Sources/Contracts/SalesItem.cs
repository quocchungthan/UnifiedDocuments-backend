namespace UnifiedDocuments.Sync.Sources.Contracts;

internal sealed record SalesItem(
    string DocumentId,
    string? DealNumber,
    string FileName,
    string ContentType,
    DateTimeOffset LastModifiedUtc);