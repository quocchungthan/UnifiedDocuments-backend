using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync;

public sealed class DocumentSyncWorker(
    IServiceScopeFactory scopes,
    IOptions<SyncOptions> options,
    ILogger<DocumentSyncWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(options.Value.Interval);
        do
        {
            await SyncAllAsync(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SyncAllAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var sourceNames = scope.ServiceProvider.GetServices<IDocumentSource>()
            .Select(source => source.SourceName)
            .ToArray();

        await Task.WhenAll(sourceNames.Select(sourceName => SyncSourceAsync(sourceName, cancellationToken)));
    }

    private async Task SyncSourceAsync(string sourceName, CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        try
        {
            var source = scope.ServiceProvider.GetServices<IDocumentSource>()
                .Single(candidate => candidate.SourceName == sourceName);
            var synchronizer = scope.ServiceProvider.GetRequiredService<DocumentSynchronizer>();
            await synchronizer.SyncAsync(source, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // One unavailable system must not stop the others or crash the host.
            logger.LogError(ex, "Sync of {Source} failed; retrying on the next run.", sourceName);
        }
    }
}
