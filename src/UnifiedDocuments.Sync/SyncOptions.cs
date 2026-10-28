namespace UnifiedDocuments.Sync;

public sealed class SyncOptions
{
    public TimeSpan Interval { get; set; } = TimeSpan.FromMinutes(15);
}

public sealed class OAuthSourceOptions
{
    public required Uri BaseUrl { get; set; }
    public required string ClientId { get; set; }
    public required string ClientSecret { get; set; }
}

public sealed class BasicSourceOptions
{
    public required Uri BaseUrl { get; set; }
    public required string Username { get; set; }
    public required string Password { get; set; }
}

public sealed class DealershipSystemsOptions
{
    public required OAuthSourceOptions Sales { get; set; }
    public required OAuthSourceOptions Service { get; set; }
    public required BasicSourceOptions Warranty { get; set; }
}
