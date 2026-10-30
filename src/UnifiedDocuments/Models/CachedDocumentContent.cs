namespace UnifiedDocuments.Models;

internal sealed record CachedDocumentContent(byte[] Content, string ContentHash);