namespace UnifiedDocuments.Data.Entities;

// A document with no rows here is "unlinked".
public class DocumentVin
{
    public long SourceDocumentId { get; set; }
    public required string Vin { get; set; }

    public SourceDocument SourceDocument { get; set; } = null!;
}
