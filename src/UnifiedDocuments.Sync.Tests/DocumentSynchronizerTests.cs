using System.Runtime.CompilerServices;
using System.Text;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using UnifiedDocuments.Data;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentSynchronizerTests
{
    [Theory]
    [InlineData("Repair order for VIN 1HGCM82633A004352", "1HGCM82633A004352")]
    [InlineData("General workshop instructions without a vehicle number", null)]
    public async Task SyncAsync_retains_indexed_metadata_with_or_without_a_detected_vin(string content, string? expectedVin)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<UnifiedDocumentsDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new UnifiedDocumentsDbContext(options);
        await db.Database.EnsureCreatedAsync();

        var modifiedAt = DateTimeOffset.UtcNow;
        var source = new FakeDocumentSource("TestProvider", "doc-1", modifiedAt, content);
        var synchronizer = CreateSynchronizer(db);

        var result = await synchronizer.SyncAsync(source, CancellationToken.None);

        var stored = await db.SourceDocuments.Include(document => document.Vins).SingleAsync();
        Assert.Equal(new SyncResult("TestProvider", 1, 0, 0, 0), result);
        Assert.Equal("doc-1", stored.SourceDocumentId);
        Assert.Equal("repair-order.txt", stored.FileName);
        Assert.Equal(expectedVin is null ? [] : new[] { expectedVin }, stored.Vins.Select(link => link.Vin));
        Assert.Equal(1, source.OpenCount);

        var unchanged = await synchronizer.SyncAsync(source, CancellationToken.None);

        Assert.Equal(new SyncResult("TestProvider", 0, 0, 1, 0), unchanged);
        Assert.Equal(1, source.OpenCount);
    }

    [Fact]
    public async Task SyncAsync_times_out_a_stalled_document_body()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var options = new DbContextOptionsBuilder<UnifiedDocumentsDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new UnifiedDocumentsDbContext(options);
        await db.Database.EnsureCreatedAsync();
        var source = new FakeDocumentSource("TestProvider", "doc-1", DateTimeOffset.UtcNow, "unused")
        {
            Stream = new StallingStream(),
        };
        var synchronizer = CreateSynchronizer(db, TimeSpan.FromMilliseconds(50));

        var exception = await Assert.ThrowsAsync<TimeoutException>(
            () => synchronizer.SyncAsync(source, CancellationToken.None));

        Assert.Contains("configured timeout", exception.Message);
        Assert.Empty(await db.SourceDocuments.ToListAsync());
    }

    [Fact]
    public async Task SyncAsync_updates_vin_links_and_removes_documents_missing_from_a_successful_listing()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var dbOptions = new DbContextOptionsBuilder<UnifiedDocumentsDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new UnifiedDocumentsDbContext(dbOptions);
        await db.Database.EnsureCreatedAsync();
        var source = new MutableDocumentSource("TestProvider");
        var modifiedAt = DateTimeOffset.UtcNow;
        source.Documents.Add(new ListedDocument("doc-1", "repair-order.txt", "text/plain", "RO-42", modifiedAt));
        source.Content.Add("doc-1", "VIN 1HGCM82633A004352 VIN 3DDDDDDDDDDDDDDDD");
        var synchronizer = CreateSynchronizer(db);

        var added = await synchronizer.SyncAsync(source, CancellationToken.None);
        source.Documents[0] = source.Documents[0] with { ModifiedAt = modifiedAt.AddSeconds(1) };
        source.Content["doc-1"] = "Updated repair order for VIN 3DDDDDDDDDDDDDDDD";
        var updated = await synchronizer.SyncAsync(source, CancellationToken.None);

        var stored = await db.SourceDocuments.Include(document => document.Vins).SingleAsync();
        Assert.Equal(new SyncResult("TestProvider", 1, 0, 0, 0), added);
        Assert.Equal(new SyncResult("TestProvider", 0, 1, 0, 0), updated);
        Assert.Equal(["3DDDDDDDDDDDDDDDD"], stored.Vins.Select(link => link.Vin));

        source.Documents.Clear();
        await Task.Delay(5);
        var removed = await synchronizer.SyncAsync(source, CancellationToken.None);

        Assert.Equal(new SyncResult("TestProvider", 0, 0, 0, 1), removed);
        Assert.Empty(await db.SourceDocuments.ToListAsync());
    }

    [Fact]
    public async Task SyncAsync_retains_documents_when_source_listing_fails()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var dbOptions = new DbContextOptionsBuilder<UnifiedDocumentsDbContext>()
            .UseSqlite(connection)
            .Options;
        await using var db = new UnifiedDocumentsDbContext(dbOptions);
        await db.Database.EnsureCreatedAsync();
        var source = new MutableDocumentSource("TestProvider");
        source.Documents.Add(new ListedDocument("doc-1", "repair-order.txt", "text/plain", "RO-42", DateTimeOffset.UtcNow));
        source.Content.Add("doc-1", "VIN 1HGCM82633A004352");
        var synchronizer = CreateSynchronizer(db);
        await synchronizer.SyncAsync(source, CancellationToken.None);

        source.FailListing = true;

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => synchronizer.SyncAsync(source, CancellationToken.None));

        Assert.Equal("doc-1", Assert.Single(await db.SourceDocuments.Select(document => document.SourceDocumentId).ToListAsync()));
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
        Assert.NotNull(provider.GetRequiredService<TextExtractor>());
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

    private static DocumentSynchronizer CreateSynchronizer(
        UnifiedDocumentsDbContext db,
        TimeSpan? documentReadTimeout = null) =>
        new(
            db,
            new TextExtractor(
            [
                new PdfTextExtractionStrategy(),
                new EmailTextExtractionStrategy(),
                new TextDocumentExtractionStrategy(),
            ],
            NullLogger<TextExtractor>.Instance),
            TimeProvider.System,
            Options.Create(new SyncOptions
            {
                DocumentReadTimeout = documentReadTimeout ?? TimeSpan.FromMinutes(2),
            }),
            NullLogger<DocumentSynchronizer>.Instance);

    private sealed class FakeDocumentSource(
        string sourceName,
        string documentId,
        DateTimeOffset modifiedAt,
        string content) : IDocumentSource
    {
        public string SourceName => sourceName;
        public int OpenCount { get; private set; }
        public Stream? Stream { get; init; }

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
            return Task.FromResult(Stream ?? new MemoryStream(Encoding.UTF8.GetBytes(content)));
        }
    }

    private sealed class StallingStream : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() => throw new NotSupportedException();
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) =>
            Task.Delay(Timeout.Infinite, cancellationToken).ContinueWith(
                _ => 0,
                cancellationToken,
                TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
    }

    private sealed class MutableDocumentSource(string sourceName) : IDocumentSource
    {
        public string SourceName => sourceName;
        public List<ListedDocument> Documents { get; } = [];
        public Dictionary<string, string> Content { get; } = [];
        public bool FailListing { get; set; }

        public async IAsyncEnumerable<ListedDocument> ListAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await Task.Yield();
            foreach (var document in Documents)
            {
                cancellationToken.ThrowIfCancellationRequested();
                yield return document;
            }

            if (FailListing)
                throw new InvalidOperationException("Simulated incomplete listing.");
        }

        public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult<Stream>(new MemoryStream(Encoding.UTF8.GetBytes(Content[sourceDocumentId])));
        }
    }
}
