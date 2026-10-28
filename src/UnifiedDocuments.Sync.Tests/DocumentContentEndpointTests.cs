using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Endpoints;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync.Tests;

public sealed class DocumentContentEndpointTests
{
    [Fact]
    public async Task GetContent_serves_inline_and_download_content_and_revalidates_without_refetching()
    {
        var pdfContent = Encoding.UTF8.GetBytes("PDF bytes for 1HGCM82633A004352");
        var largeContent = new byte[10 * 1024 * 1024 + 1];
        Array.Fill(largeContent, (byte)'x');
        var source = new FakeDocumentSource("Warranty", new Dictionary<string, byte[]>
        {
            ["WD-123"] = pdfContent,
            ["WD-LARGE"] = largeContent,
        });
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();

        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddDbContext<UnifiedDocumentsDbContext>(options => options.UseSqlite(connection));
        builder.Services.AddSingleton<IDocumentSource>(source);
        builder.Services.AddMemoryCache(options => options.SizeLimit = 64 * 1024 * 1024);

        await using var app = builder.Build();
        app.MapVehicleDocumentsEndpoints();
        await app.StartAsync();

        try
        {
            await using (var scope = app.Services.CreateAsyncScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<UnifiedDocumentsDbContext>();
                await db.Database.EnsureCreatedAsync();
                db.SourceDocuments.AddRange(
                    CreateDocument("WD-123", "claim form.pdf", "application/pdf", pdfContent),
                    CreateDocument("WD-LARGE", "large-note.txt", "text/plain", largeContent));
                await db.SaveChangesAsync();
            }

            var address = app.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()!
                .Addresses.Single();
            using var client = new HttpClient { BaseAddress = new Uri(address) };

            using var viewResponse = await client.GetAsync("/documents/Warranty/WD-123/content");
            Assert.Equal(StatusCodes.Status200OK, (int)viewResponse.StatusCode);
            Assert.Equal("inline", viewResponse.Content.Headers.ContentDisposition?.DispositionType);
            Assert.True(viewResponse.Headers.CacheControl?.Private);
            Assert.Equal(TimeSpan.FromMinutes(15), viewResponse.Headers.CacheControl?.MaxAge);
            Assert.Equal(pdfContent, await viewResponse.Content.ReadAsByteArrayAsync());
            Assert.NotNull(viewResponse.Headers.ETag);
            Assert.Equal(1, source.OpenCount);

            using var conditionalRequest = new HttpRequestMessage(HttpMethod.Get, "/documents/Warranty/WD-123/content");
            conditionalRequest.Headers.IfNoneMatch.Add(viewResponse.Headers.ETag!);
            using var notModified = await client.SendAsync(conditionalRequest);
            Assert.Equal(StatusCodes.Status304NotModified, (int)notModified.StatusCode);
            Assert.Equal(1, source.OpenCount);

            using var downloadResponse = await client.GetAsync("/documents/Warranty/WD-123/content?download=true");
            Assert.Equal("attachment", downloadResponse.Content.Headers.ContentDisposition?.DispositionType);
            Assert.Contains("claim%20form.pdf", downloadResponse.Content.Headers.GetValues("Content-Disposition").Single());
            Assert.Equal(pdfContent, await downloadResponse.Content.ReadAsByteArrayAsync());
            Assert.Equal(1, source.OpenCount);

            using var missingResponse = await client.GetAsync("/documents/Warranty/unknown/content");
            Assert.Equal(StatusCodes.Status404NotFound, (int)missingResponse.StatusCode);
            Assert.Equal(1, source.OpenCount);

            using var largeResponse = await client.GetAsync("/documents/Warranty/WD-LARGE/content");
            Assert.Equal(largeContent, await largeResponse.Content.ReadAsByteArrayAsync());
            Assert.Equal(2, source.OpenCount);

            using var repeatedLargeResponse = await client.GetAsync("/documents/Warranty/WD-LARGE/content");
            Assert.Equal(largeContent, await repeatedLargeResponse.Content.ReadAsByteArrayAsync());
            Assert.Equal(3, source.OpenCount);
        }
        finally
        {
            await app.StopAsync();
        }
    }

    private static SourceDocument CreateDocument(string id, string fileName, string contentType, byte[] content) => new()
    {
        SourceName = "Warranty",
        SourceDocumentId = id,
        FileName = fileName,
        ContentType = contentType,
        BusinessKey = "WC-2025-0001",
        ContentHash = Convert.ToHexStringLower(SHA256.HashData(content)),
        LastSeenAt = DateTimeOffset.UtcNow,
        IndexedAt = DateTimeOffset.UtcNow,
    };

    private sealed class FakeDocumentSource(string sourceName, IReadOnlyDictionary<string, byte[]> documents) : IDocumentSource
    {
        public string SourceName => sourceName;
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
            if (!documents.TryGetValue(sourceDocumentId, out var content))
                throw new KeyNotFoundException(sourceDocumentId);
            OpenCount++;
            return Task.FromResult<Stream>(new MemoryStream(content, writable: false));
        }
    }
}
