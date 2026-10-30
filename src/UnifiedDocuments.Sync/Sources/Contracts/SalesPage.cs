namespace UnifiedDocuments.Sync.Sources.Contracts;

internal sealed record SalesPage(int TotalPages, List<SalesItem> Items);