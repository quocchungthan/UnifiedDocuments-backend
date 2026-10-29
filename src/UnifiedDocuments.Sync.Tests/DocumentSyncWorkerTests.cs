using System.Runtime.CompilerServices;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using UnifiedDocuments.Data;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentSyncWorkerTests
{
    [Fact]
    public async Task ExecuteAsync_syncs_sources_concurrently_and_isolates_a_source_failure()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"projectloop-sync-{Guid.NewGuid():N}.db");
        var barrier = new SourceBarrier(2);
        var sales = new BlockingSource("Sales", barrier, fail: true);
        var service = new BlockingSource("Service", barrier);
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddDbContext<UnifiedDocumentsDbContext>(options =>
            options.UseSqlite(new SqliteConnectionStringBuilder { DataSource = databasePath, Pooling = false }.ToString()));
        services.AddScoped<DocumentSynchronizer>();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<ITextExtractionStrategy, PdfTextExtractionStrategy>();
        services.AddSingleton<ITextExtractionStrategy, EmailTextExtractionStrategy>();
        services.AddSingleton<ITextExtractionStrategy, TextDocumentExtractionStrategy>();
        services.AddSingleton<TextExtractor>();
        services.AddSingleton<IDocumentSource>(sales);
        services.AddSingleton<IDocumentSource>(service);
        using var provider = services.BuildServiceProvider();

        try
        {
            await using (var scope = provider.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<UnifiedDocumentsDbContext>();
                await db.Database.EnsureCreatedAsync();
            }

            var worker = new DocumentSyncWorker(
                provider.GetRequiredService<IServiceScopeFactory>(),
                Options.Create(new SyncOptions { Interval = TimeSpan.FromHours(1) }),
                NullLogger<DocumentSyncWorker>.Instance);

            await worker.StartAsync(CancellationToken.None);
            try
            {
                await Task.WhenAll(sales.Completed, service.Completed).WaitAsync(TimeSpan.FromSeconds(5));
            }
            finally
            {
                await worker.StopAsync(CancellationToken.None);
            }

            Assert.True(barrier.AllStarted.IsCompletedSuccessfully);
            Assert.True(sales.FailedAsExpected);
            Assert.True(service.CompletedSuccessfully);
        }
        finally
        {
            SqliteConnection.ClearAllPools();
            if (File.Exists(databasePath))
                File.Delete(databasePath);
            if (File.Exists(databasePath + "-shm"))
                File.Delete(databasePath + "-shm");
            if (File.Exists(databasePath + "-wal"))
                File.Delete(databasePath + "-wal");
        }
    }

    private sealed class SourceBarrier(int sourceCount)
    {
        private readonly TaskCompletionSource allStarted = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int started;

        public Task AllStarted => allStarted.Task;

        public void SignalStarted()
        {
            if (Interlocked.Increment(ref started) == sourceCount)
                allStarted.TrySetResult();
        }
    }

    private sealed class BlockingSource(string sourceName, SourceBarrier barrier, bool fail = false) : IDocumentSource
    {
        private readonly TaskCompletionSource completed = new(TaskCreationOptions.RunContinuationsAsynchronously);

        public string SourceName => sourceName;
        public Task Completed => completed.Task;
        public bool FailedAsExpected { get; private set; }
        public bool CompletedSuccessfully { get; private set; }

        public async IAsyncEnumerable<ListedDocument> ListAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            try
            {
                barrier.SignalStarted();
                await barrier.AllStarted.WaitAsync(cancellationToken);
                if (fail)
                {
                    FailedAsExpected = true;
                    throw new InvalidOperationException("Simulated source failure.");
                }

                CompletedSuccessfully = true;
                yield break;
            }
            finally
            {
                completed.TrySetResult();
            }
        }

        public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }
}
