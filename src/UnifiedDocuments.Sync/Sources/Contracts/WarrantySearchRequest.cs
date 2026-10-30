namespace UnifiedDocuments.Sync.Sources.Contracts;

internal sealed record WarrantySearchRequest(string? ClaimNumber, string? PageToken, int MaxResults);