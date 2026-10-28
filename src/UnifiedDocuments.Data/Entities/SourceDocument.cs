namespace UnifiedDocuments.Data.Entities;

// One row per document listed by a dealership system; content is never stored.
public class SourceDocument
{
    public long Id { get; set; }
    public required string SourceName { get; set; }
    public required string SourceDocumentId { get; set; }
    public required string FileName { get; set; }
    public required string ContentType { get; set; }
    public string? BusinessKey { get; set; }
    public required string ContentHash { get; set; }
    public DateTimeOffset? ModifiedAt { get; set; }
    public DateTimeOffset LastSeenAt { get; set; }
    public DateTimeOffset IndexedAt { get; set; }

    public List<DocumentVin> Vins { get; set; } = [];
}
