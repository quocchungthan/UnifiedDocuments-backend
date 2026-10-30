namespace UnifiedDocuments.Sync;

public sealed class SyncOptions
{
    public TimeSpan Interval { get; set; } = TimeSpan.FromMinutes(15);
    public TimeSpan DocumentReadTimeout { get; set; } = TimeSpan.FromMinutes(2);
}
