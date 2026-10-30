namespace UnifiedDocuments.Sync;

public sealed record SyncResult(string SourceName, int Added, int Updated, int Unchanged, int Removed);