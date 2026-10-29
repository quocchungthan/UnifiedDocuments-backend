namespace UnifiedDocuments.Sync;

public sealed class SyncOptions
{
    public TimeSpan Interval { get; set; } = TimeSpan.FromMinutes(15);
    public TimeSpan DocumentReadTimeout { get; set; } = TimeSpan.FromMinutes(2);
}

public sealed class OAuthSourceOptions
{
    public bool Enabled { get; set; } = true;
    public Uri? BaseUrl { get; set; }
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
}

public sealed class BasicSourceOptions
{
    public bool Enabled { get; set; } = true;
    public Uri? BaseUrl { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
}

public sealed class DealershipSystemsOptions
{
    public OAuthSourceOptions Sales { get; set; } = new();
    public OAuthSourceOptions Service { get; set; } = new();
    public BasicSourceOptions Warranty { get; set; } = new();
}
