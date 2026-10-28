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
        var synchronizer = scope.ServiceProvider.GetRequiredService<DocumentSynchronizer>();

        foreach (var source in scope.ServiceProvider.GetServices<IDocumentSource>())
        {
            try
            {
                await synchronizer.SyncAsync(source, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // One unavailable system must not stop the others or crash the host.
                logger.LogError(ex, "Sync of {Source} failed; retrying on the next run.", source.SourceName);
            }
        }
    }
}
