using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using UnifiedDocuments.Data;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentSynchronizerTests
{
    [Fact]
    public async Task SyncAsync_accepts_a_substitute_source_and_indexes_its_document()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<UnifiedDocumentsDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new UnifiedDocumentsDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var modifiedAt = DateTimeOffset.UtcNow;
        var source = new FakeDocumentSource("TestProvider", "doc-1", modifiedAt,
            "Repair order for VIN 1HGCM82633A004352");
        var synchronizer = new DocumentSynchronizer(
            db,
            new TextExtractor(NullLogger<TextExtractor>.Instance),
            TimeProvider.System,
            NullLogger<DocumentSynchronizer>.Instance);

        var result = await synchronizer.SyncAsync(source, CancellationToken.None);

        var stored = await db.SourceDocuments.Include(document => document.Vins).SingleAsync();
        Assert.Equal(new SyncResult("TestProvider", 1, 0, 0, 0), result);
        Assert.Equal("doc-1", stored.SourceDocumentId);
        Assert.Equal("repair-order.txt", stored.FileName);
        Assert.Equal("1HGCM82633A004352", Assert.Single(stored.Vins).Vin);
        Assert.Equal(1, source.OpenCount);
    }

    [Fact]
    public void AddUnifiedDocumentsSync_does_not_register_disabled_provider_or_require_credentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DealershipSystems:Sales:Enabled"] = "false",
                ["DealershipSystems:Service:Enabled"] = "false",
                ["DealershipSystems:Warranty:Enabled"] = "false",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();

        services.AddUnifiedDocumentsSync(configuration);

        using var provider = services.BuildServiceProvider();
        Assert.Empty(provider.GetServices<IDocumentSource>());
    }

    [Fact]
    public void AddUnifiedDocumentsSync_registers_only_enabled_provider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["DealershipSystems:Sales:Enabled"] = "true",
                ["DealershipSystems:Sales:BaseUrl"] = "http://localhost:5101",
                ["DealershipSystems:Sales:ClientId"] = "test-client",
                ["DealershipSystems:Sales:ClientSecret"] = "test-secret",
                ["DealershipSystems:Service:Enabled"] = "false",
                ["DealershipSystems:Warranty:Enabled"] = "false",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddUnifiedDocumentsSync(configuration);

        using var provider = services.BuildServiceProvider();
        Assert.Equal("Sales", Assert.Single(provider.GetServices<IDocumentSource>()).SourceName);
    }

    private sealed class FakeDocumentSource(
        string sourceName,
        string documentId,
        DateTimeOffset modifiedAt,
        string content) : IDocumentSource
    {
        public string SourceName => sourceName;
        public int OpenCount { get; private set; }

        public async IAsyncEnumerable<ListedDocument> ListAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await Task.Yield();
            yield return new ListedDocument(documentId, "repair-order.txt", "text/plain", "RO-42", modifiedAt);
        }

        public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Assert.Equal(documentId, sourceDocumentId);
            OpenCount++;
            return Task.FromResult<Stream>(new MemoryStream(Encoding.UTF8.GetBytes(content)));
        }
    }
}
