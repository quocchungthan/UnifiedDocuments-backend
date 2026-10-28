using System.Text;
using Microsoft.Extensions.Logging;
using MimeKit;
using UglyToad.PdfPig;

namespace UnifiedDocuments.Sync.Extraction;

public sealed class TextExtractor(ILogger<TextExtractor> logger)
{
    public string Extract(byte[] content, string contentType)
    {
        try
        {
            return contentType.Split(';')[0].Trim().ToLowerInvariant() switch
            {
                "application/pdf" => ExtractPdf(content),
                "message/rfc822" => ExtractEmail(content),
                _ => Encoding.UTF8.GetString(content),
            };
        }
        catch (Exception ex)
        {
            // Malformed files still often carry the VIN as plain bytes.
            logger.LogWarning(ex, "Could not parse {ContentType}; scanning raw bytes instead.", contentType);
            return Encoding.Latin1.GetString(content);
        }
    }

    private static string ExtractPdf(byte[] content)
    {
        using var pdf = PdfDocument.Open(content);
        return string.Join('\n', pdf.GetPages().Select(page => page.Text));
    }

    private static string ExtractEmail(byte[] content)
    {
        using var stream = new MemoryStream(content);
        var message = MimeMessage.Load(stream);
        return string.Join('\n', message.Subject, message.TextBody, message.HtmlBody);
    }
}
