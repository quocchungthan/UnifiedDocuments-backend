namespace UnifiedDocuments.Sync;

public sealed class OAuthSourceOptions
{
    public bool Enabled { get; set; } = true;
    public Uri? BaseUrl { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
}