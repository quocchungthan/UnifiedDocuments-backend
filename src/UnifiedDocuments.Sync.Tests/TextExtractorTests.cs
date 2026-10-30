using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using UnifiedDocuments.Sync.Extraction;

namespace UnifiedDocuments.Sync.Tests;

public sealed class TextExtractorTests
{
    private readonly TextExtractor _extractor = new(
    [
        new PdfTextExtractionStrategy(),
        new EmailTextExtractionStrategy(),
        new TextDocumentExtractionStrategy(),
    ],
    NullLogger<TextExtractor>.Instance);

    [Theory]
    [InlineData("text/plain")]
    [InlineData("text/csv")]
    [InlineData("text/html")]
    [InlineData("text/markdown")]
    [InlineData("application/json")]
    [InlineData("application/xml")]
    [InlineData("image/svg+xml")]
    public void Extract_SupportedTextualFormatWithCharset_ReturnsOriginalTextIncludingVin(string mediaType)
    {
        const string text = "Vehicle VIN: 1HGCM82633A004352";
        var content = Encoding.UTF8.GetBytes(text);

        var extracted = _extractor.Extract(content, $"{mediaType}; charset=utf-8");

        Assert.Equal(text, extracted);
        Assert.Contains("1HGCM82633A004352", extracted);
    }

    [Fact]
    public void Extract_Rfc822Email_ReturnsSubjectAndBodyText()
    {
        const string email = """
            From: service@example.test
            To: operations@example.test
            Subject: Vehicle record 1HGCM82633A004352
            MIME-Version: 1.0
            Content-Type: text/plain; charset=utf-8

            Repair note for VIN 1HGCM82633A004352.
            """;

        var extracted = _extractor.Extract(Encoding.UTF8.GetBytes(email), "message/rfc822");

        Assert.Contains("Vehicle record 1HGCM82633A004352", extracted);
        Assert.Contains("Repair note for VIN 1HGCM82633A004352.", extracted);
    }

    [Fact]
    public void Extract_MalformedPdf_ReturnsVinFromRawTextFallback()
    {
        const string text = "Malformed PDF with VIN 1HGCM82633A004352";

        var extracted = _extractor.Extract(Encoding.UTF8.GetBytes(text), "application/pdf");

        Assert.Contains("1HGCM82633A004352", extracted);
    }
}
