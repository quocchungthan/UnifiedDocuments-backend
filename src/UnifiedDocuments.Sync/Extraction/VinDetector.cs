using System.Text.RegularExpressions;

namespace UnifiedDocuments.Sync.Extraction;

public static partial class VinDetector
{
    public static IReadOnlySet<string> Find(string text) =>
        VinPattern().Matches(text)
            .Select(m => m.Value.ToUpperInvariant())
            // VINs mix letters and digits; this filters out long numbers and words.
            .Where(v => v.Any(char.IsDigit) && v.Any(char.IsLetter))
            .ToHashSet(StringComparer.Ordinal);

    // Check digit is not enforced: most non-North-American VINs do not use one.
    [GeneratedRegex("(?<![A-Z0-9])[A-HJ-NPR-Z0-9]{17}(?![A-Z0-9])", RegexOptions.IgnoreCase)]
    private static partial Regex VinPattern();
}
