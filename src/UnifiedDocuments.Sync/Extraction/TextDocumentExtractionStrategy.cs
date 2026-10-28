using System.Text;

namespace UnifiedDocuments.Sync.Extraction;

public sealed class TextDocumentExtractionStrategy : ITextExtractionStrategy
{
    public bool CanHandle(string mediaType) =>
        mediaType.StartsWith("text/", StringComparison.Ordinal) ||
        mediaType == "image/svg+xml" ||
        mediaType == "application/json" ||
        mediaType == "application/xml" ||
        mediaType.EndsWith("+json", StringComparison.Ordinal) ||
        mediaType.EndsWith("+xml", StringComparison.Ordinal);

    public string Extract(byte[] content) => Encoding.UTF8.GetString(content);
}
