using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Endpoints;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

internal sealed class DocumentApiFixture : IAsyncDisposable
{
    private readonly SqliteConnection connection;
    private readonly WebApplication app;
    public HttpClient Client { get; }
    public FakeDocumentSource Source { get; }

    private DocumentApiFixture(SqliteConnection connection, WebApplication app, HttpClient client, FakeDocumentSource source)
    {
        this.connection = connection;
        this.app = app;
        Client = client;
        Source = source;
    }

    public static async Task<DocumentApiFixture> CreateAsync(params SourceDocument[] documents)
    {
        var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var source = new FakeDocumentSource();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddDbContext<UnifiedDocumentsDbContext>(options => options.UseSqlite(connection));
        builder.Services.AddSingleton<IDocumentSource>(source);
        builder.Services.AddMemoryCache(options => options.SizeLimit = 64 * 1024 * 1024);

        var app = builder.Build();
        app.MapVehicleDocumentsEndpoints();
        await using (var scope = app.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<UnifiedDocumentsDbContext>();
            await db.Database.EnsureCreatedAsync();
            db.SourceDocuments.AddRange(documents);
            await db.SaveChangesAsync();
        }
        await app.StartAsync();
        var addresses = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()
            ?? throw new InvalidOperationException("The test API did not publish its address.");
        var client = new HttpClient { BaseAddress = new Uri(addresses.Addresses.Single()) };
        return new DocumentApiFixture(connection, app, client, source);
    }

    public static SourceDocument Document(
        string id, byte[] content, string contentType = "application/pdf", string? vin = null,
        string source = "Warranty", int day = 1) => new()
    {
        SourceName = source,
        SourceDocumentId = id,
        FileName = $"{id}.pdf",
        ContentType = contentType,
        BusinessKey = "WC-2025-0001",
        ContentHash = Convert.ToHexStringLower(SHA256.HashData(content)),
        LastSeenAt = new DateTimeOffset(2026, 1, day, 0, 0, 0, TimeSpan.Zero),
        IndexedAt = new DateTimeOffset(2026, 1, day, 0, 0, 0, TimeSpan.Zero),
        Vins = vin is null ? [] : [new DocumentVin { Vin = vin }],
    };

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await app.StopAsync();
        await app.DisposeAsync();
        await connection.DisposeAsync();
    }

    internal sealed class FakeDocumentSource : IDocumentSource
    {
        public string SourceName => "Warranty";
        public Dictionary<string, byte[]> Documents { get; } = [];
        public int OpenCount { get; private set; }

        public async IAsyncEnumerable<ListedDocument> ListAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            await Task.Yield();
            yield break;
        }

        public Task<Stream> OpenAsync(string sourceDocumentId, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var content = Documents[sourceDocumentId];
            OpenCount++;
            return Task.FromResult<Stream>(new MemoryStream(content, writable: false));
        }
    }
}
