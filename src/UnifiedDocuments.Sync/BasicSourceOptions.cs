namespace UnifiedDocuments.Sync;

public sealed class BasicSourceOptions
{
    public bool Enabled { get; set; } = true;
    public Uri? BaseUrl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}