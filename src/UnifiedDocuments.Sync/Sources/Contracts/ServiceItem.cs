namespace UnifiedDocuments.Sync.Sources.Contracts;

internal sealed record ServiceItem(
    string RecordId,
    string DocumentKind,
    string FileName,
    string MimeType,
    DateTimeOffset UploadedAt);