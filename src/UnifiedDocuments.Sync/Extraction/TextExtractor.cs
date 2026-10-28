using System.Text;
using Microsoft.Extensions.Logging;

namespace UnifiedDocuments.Sync.Extraction;

public sealed class TextExtractor(
    IEnumerable<ITextExtractionStrategy> strategies,
    ILogger<TextExtractor> logger)
{
    public string Extract(byte[] content, string contentType)
    {
        var mediaType = contentType.Split(';', 2)[0].Trim().ToLowerInvariant();
        try
        {
            var strategy = strategies.FirstOrDefault(candidate => candidate.CanHandle(mediaType));
            return strategy?.Extract(content) ?? Encoding.UTF8.GetString(content);
        }
        catch (Exception ex)
        {
            // Malformed files still often carry the VIN as plain bytes.
            logger.LogWarning(ex, "Could not parse {ContentType}; scanning raw bytes instead.", mediaType);
            return Encoding.Latin1.GetString(content);
        }
    }
}
