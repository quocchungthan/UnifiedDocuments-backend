namespace UnifiedDocuments.Sync;

public sealed class DealershipSystemsOptions
{
    public OAuthSourceOptions Sales { get; set; } = new();
    public OAuthSourceOptions Service { get; set; } = new();
    public BasicSourceOptions Warranty { get; set; } = new();
}