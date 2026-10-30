namespace UnifiedDocuments.Sync.Sources.Contracts;

internal sealed record WarrantySearchResponse(List<WarrantyItem> Documents, string? NextPageToken);