using System.Buffers.Text;
using System.Text;

namespace WarrantySystem.Shared;

// Opaque continuation token; clients must not parse it.
public static class PageToken
{
    private const string Prefix = "w1:";

    public static string Encode(int offset) =>
        Base64Url.EncodeToString(Encoding.UTF8.GetBytes(Prefix + offset));

    public static bool TryDecode(string? token, out int offset)
    {
        offset = 0;
        if (string.IsNullOrEmpty(token))
            return true;

        try
        {
            var raw = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(token));
            return raw.StartsWith(Prefix, StringComparison.Ordinal)
                && int.TryParse(raw.AsSpan(Prefix.Length), out offset)
                && offset >= 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
