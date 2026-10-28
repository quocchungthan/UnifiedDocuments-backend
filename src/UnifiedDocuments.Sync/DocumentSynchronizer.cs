using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync;

public sealed record SyncResult(string SourceName, int Added, int Updated, int Unchanged, int Removed);

public sealed class DocumentSynchronizer(
    UnifiedDocumentsDbContext db,
    TextExtractor extractor,
    TimeProvider time,
    ILogger<DocumentSynchronizer> logger)
{
    public async Task<SyncResult> SyncAsync(IDocumentSource source, CancellationToken cancellationToken)
    {
        var runStartedAt = time.GetUtcNow();
        var known = await db.SourceDocuments
            .Include(d => d.Vins)
            .Where(d => d.SourceName == source.SourceName)
            .ToDictionaryAsync(d => d.SourceDocumentId, cancellationToken);
        int added = 0, updated = 0, unchanged = 0;

        await foreach (var listed in source.ListAllAsync(cancellationToken))
        {
            known.TryGetValue(listed.SourceDocumentId, out var document);

            if (document is not null && SameInstant(document.ModifiedAt, listed.ModifiedAt))
            {
                ApplyMetadata(document, listed, runStartedAt);
                unchanged++;
                continue;
            }

            // Content lives in memory only for this step; it is never persisted.
            var content = await ReadAllAsync(source, listed.SourceDocumentId, cancellationToken);
            var hash = Convert.ToHexStringLower(SHA256.HashData(content));

            if (document is null)
            {
                document = new SourceDocument
                {
                    SourceName = source.SourceName,
                    SourceDocumentId = listed.SourceDocumentId,
                    FileName = listed.FileName,
                    ContentType = listed.ContentType,
                    ContentHash = hash,
                };
                db.SourceDocuments.Add(document);
                known[listed.SourceDocumentId] = document;
                added++;
            }
            else if (document.ContentHash == hash)
            {
                ApplyMetadata(document, listed, runStartedAt);
                unchanged++;
                continue;
            }
            else
            {
                updated++;
            }

            ApplyMetadata(document, listed, runStartedAt);
            document.ContentHash = hash;
            document.IndexedAt = runStartedAt;
            ReplaceVins(document, VinDetector.Find(extractor.Extract(content, listed.ContentType)));
            await db.SaveChangesAsync(cancellationToken);
        }

        // Only reached when the full listing succeeded, so a failed sync never deletes anything.
        var removed = known.Values.Where(d => d.LastSeenAt < runStartedAt).ToList();
        db.SourceDocuments.RemoveRange(removed);
        await db.SaveChangesAsync(cancellationToken);

        var result = new SyncResult(source.SourceName, added, updated, unchanged, removed.Count);
        logger.LogInformation("Synced {Source}: {Added} added, {Updated} updated, {Unchanged} unchanged, {Removed} removed.",
            result.SourceName, result.Added, result.Updated, result.Unchanged, result.Removed);
        return result;
    }

    // The SQLite date converter keeps 0.1 ms precision, so exact equality would never match.
    private static bool SameInstant(DateTimeOffset? stored, DateTimeOffset? listed) =>
        stored is not null && listed is not null && (stored.Value - listed.Value).Duration() < TimeSpan.FromMilliseconds(1);

    private static void ApplyMetadata(SourceDocument document, ListedDocument listed, DateTimeOffset seenAt)
    {
        document.FileName = listed.FileName;
        document.ContentType = listed.ContentType;
        document.BusinessKey = listed.BusinessKey;
        document.ModifiedAt = listed.ModifiedAt;
        document.LastSeenAt = seenAt;
    }

    // Diff instead of clear-and-add, so EF never tracks a deleted and a new row with the same key.
    private static void ReplaceVins(SourceDocument document, IReadOnlySet<string> vins)
    {
        document.Vins.RemoveAll(v => !vins.Contains(v.Vin));
        foreach (var vin in vins.Where(v => document.Vins.All(existing => existing.Vin != v)))
            document.Vins.Add(new DocumentVin { Vin = vin });
    }

    private static async Task<byte[]> ReadAllAsync(IDocumentSource source, string id, CancellationToken cancellationToken)
    {
        await using var stream = await source.OpenAsync(id, cancellationToken);
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, cancellationToken);
        return buffer.ToArray();
    }
}
