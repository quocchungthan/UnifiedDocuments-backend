using MimeKit;

namespace UnifiedDocuments.Sync.Extraction;

public sealed class EmailTextExtractionStrategy : ITextExtractionStrategy
{
    public bool CanHandle(string mediaType) => mediaType == "message/rfc822";

    public string Extract(byte[] content)
    {
        using var stream = new MemoryStream(content);
        var message = MimeMessage.Load(stream);
        return string.Join('\n', message.Subject, message.TextBody, message.HtmlBody);
    }
}
