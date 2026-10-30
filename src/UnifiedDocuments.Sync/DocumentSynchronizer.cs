using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync;

public sealed class DocumentSynchronizer(
    UnifiedDocumentsDbContext db,
    TextExtractor extractor,
    TimeProvider time,
    IOptions<SyncOptions> options,
    ILogger<DocumentSynchronizer> logger)
{
    public async Task<SyncResult> SyncAsync(IDocumentSource source, CancellationToken cancellationToken)
    {
        var startedAt = time.GetTimestamp();
        var runStartedAt = time.GetUtcNow();
        var known = await LoadIndexedDocumentsAsync(source.SourceName, cancellationToken);
        int added = 0, updated = 0, unchanged = 0;

        await foreach (var listed in source.ListAllAsync(cancellationToken))
        {
            var outcome = await SynchronizeDocumentAsync(source, listed, known, runStartedAt, cancellationToken);
            switch (outcome)
            {
                case DocumentSyncOutcome.Added:
                    added++;
                    break;
                case DocumentSyncOutcome.Updated:
                    updated++;
                    break;
                case DocumentSyncOutcome.Unchanged:
                    unchanged++;
                    break;
            }
        }

        // Only reached when the full listing succeeded, so a failed sync never deletes anything.
        var removed = await RemoveMissingDocumentsAsync(known.Values, runStartedAt, cancellationToken);
        var result = new SyncResult(source.SourceName, added, updated, unchanged, removed);
        LogSyncResult(result, startedAt);
        return result;
    }

    private Task<Dictionary<string, SourceDocument>> LoadIndexedDocumentsAsync(
        string sourceName,
        CancellationToken cancellationToken) =>
        db.SourceDocuments
            .Include(document => document.Vins)
            .Where(document => document.SourceName == sourceName)
            .ToDictionaryAsync(document => document.SourceDocumentId, cancellationToken);

    private async Task<DocumentSyncOutcome> SynchronizeDocumentAsync(
        IDocumentSource source,
        ListedDocument listed,
        Dictionary<string, SourceDocument> known,
        DateTimeOffset runStartedAt,
        CancellationToken cancellationToken)
    {
        known.TryGetValue(listed.SourceDocumentId, out var document);
        if (document is not null && SameInstant(document.ModifiedAt, listed.ModifiedAt))
        {
            ApplyMetadata(document, listed, runStartedAt);
            return DocumentSyncOutcome.Unchanged;
        }

        var content = await ReadAllAsync(
            source,
            listed.SourceDocumentId,
            options.Value.DocumentReadTimeout,
            cancellationToken);
        var hash = Convert.ToHexStringLower(SHA256.HashData(content));
        var outcome = DocumentSyncOutcome.Updated;

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
            outcome = DocumentSyncOutcome.Added;
        }
        else if (document.ContentHash == hash)
        {
            ApplyMetadata(document, listed, runStartedAt);
            return DocumentSyncOutcome.Unchanged;
        }

        ApplyMetadata(document, listed, runStartedAt);
        document.ContentHash = hash;
        document.IndexedAt = runStartedAt;
        ReplaceVins(document, VinDetector.Find(extractor.Extract(content, listed.ContentType)));
        await db.SaveChangesAsync(cancellationToken);
        return outcome;
    }

    private async Task<int> RemoveMissingDocumentsAsync(
        IEnumerable<SourceDocument> known,
        DateTimeOffset runStartedAt,
        CancellationToken cancellationToken)
    {
        var removed = known.Where(document => document.LastSeenAt < runStartedAt).ToList();
        db.SourceDocuments.RemoveRange(removed);
        await db.SaveChangesAsync(cancellationToken);
        return removed.Count;
    }

    private void LogSyncResult(SyncResult result, long startedAt) =>
        logger.LogInformation(
            "Synced {Source}: {Added} added, {Updated} updated, {Unchanged} unchanged, {Removed} removed in {DurationMs} ms.",
            result.SourceName, result.Added, result.Updated, result.Unchanged, result.Removed,
            time.GetElapsedTime(startedAt).TotalMilliseconds);

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
        document.Vins.RemoveAll(link => !vins.Contains(link.Vin));
        foreach (var vin in vins.Where(candidate => document.Vins.All(existing => existing.Vin != candidate)))
            document.Vins.Add(new DocumentVin { Vin = vin });
    }

    private static async Task<byte[]> ReadAllAsync(
        IDocumentSource source,
        string id,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        if (timeout <= TimeSpan.Zero)
            throw new InvalidOperationException("Sync:DocumentReadTimeout must be greater than zero.");

        await using var stream = await source.OpenAsync(id, cancellationToken);
        using var readTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        readTimeout.CancelAfter(timeout);
        using var buffer = new MemoryStream();
        try
        {
            await stream.CopyToAsync(buffer, readTimeout.Token);
            return buffer.ToArray();
        }
        catch (OperationCanceledException exception)
            when (!cancellationToken.IsCancellationRequested && readTimeout.IsCancellationRequested)
        {
            throw new TimeoutException($"Reading document '{id}' exceeded the configured timeout of {timeout}.", exception);
        }
    }
}
