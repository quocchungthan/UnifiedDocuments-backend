namespace UnifiedDocuments.Contracts;

public sealed record DocumentPage(DocumentMetadata[] Items, string? NextCursor);