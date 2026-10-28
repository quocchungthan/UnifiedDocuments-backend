namespace UnifiedDocuments.Sync.Extraction;

public interface ITextExtractionStrategy
{
    bool CanHandle(string mediaType);
    string Extract(byte[] content);
}
