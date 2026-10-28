using UglyToad.PdfPig;

namespace UnifiedDocuments.Sync.Extraction;

public sealed class PdfTextExtractionStrategy : ITextExtractionStrategy
{
    public bool CanHandle(string mediaType) => mediaType == "application/pdf";

    public string Extract(byte[] content)
    {
        using var pdf = PdfDocument.Open(content);
        return string.Join('\n', pdf.GetPages().Select(page => page.Text));
    }
}
