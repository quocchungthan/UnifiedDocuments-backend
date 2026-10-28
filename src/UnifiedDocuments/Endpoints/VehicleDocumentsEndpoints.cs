using System.Security.Cryptography;
using System.Text.Json;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Caching.Memory;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Sync.Sources;
using UnifiedDocuments.Sync.Extraction;

namespace UnifiedDocuments.Endpoints;

public static class VehicleDocumentsEndpoints
{
    private const int CacheableDocumentLimit = 10 * 1024 * 1024;
    private const int ContentCacheMinutes = 15;

    public static IEndpointRouteBuilder MapVehicleDocumentsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/vehicles/{vin}/documents", GetDocumentsByVin);
        endpoints.MapGet("/documents/{source}/{documentId}/content", GetDocumentContent);
        return endpoints;
    }

    private static async Task<IResult> GetDocumentsByVin(
        string vin,
        UnifiedDocumentsDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var normalizedVin = vin.Trim().ToUpperInvariant();
        if (normalizedVin.Length != 17 || !VinDetector.Find(normalizedVin).Contains(normalizedVin))
            return Results.BadRequest(new { message = "VIN must be 17 characters and cannot contain I, O or Q." });

        var documents = await db.SourceDocuments
            .AsNoTracking()
            .Where(document => document.Vins.Any(link => link.Vin == normalizedVin))
            .OrderByDescending(document => document.ModifiedAt ?? document.IndexedAt)
            .ThenBy(document => document.SourceName)
            .Select(document => new
            {
                document.SourceName,
                document.SourceDocumentId,
                document.FileName,
                document.ContentType,
                document.BusinessKey,
                document.ModifiedAt,
            })
            .ToListAsync(cancellationToken);

        var responseBody = JsonSerializer.SerializeToUtf8Bytes(documents, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var entityTag = $"\"{Convert.ToHexStringLower(SHA256.HashData(responseBody))}\"";
        httpContext.Response.Headers.CacheControl = "private, max-age=60";
        httpContext.Response.Headers.ETag = entityTag;

        var requestedTags = httpContext.Request.GetTypedHeaders().IfNoneMatch;
        if (requestedTags?.Any(tag => tag.Tag.ToString() == "*" || tag.Tag.ToString() == entityTag) == true)
            return Results.StatusCode(StatusCodes.Status304NotModified);

        return Results.Bytes(responseBody, "application/json");
    }

    private static async Task<IResult> GetDocumentContent(
        string source,
        string documentId,
        UnifiedDocumentsDbContext db,
        IEnumerable<IDocumentSource> sources,
        IMemoryCache cache,
        HttpContext httpContext,
        CancellationToken cancellationToken,
        bool download = false)
    {
        var document = await db.SourceDocuments
            .AsNoTracking()
            .SingleOrDefaultAsync(
                item => item.SourceName == source && item.SourceDocumentId == documentId,
                cancellationToken);
        if (document is null)
            return Results.NotFound();

        var documentSource = sources.FirstOrDefault(item =>
            string.Equals(item.SourceName, document.SourceName, StringComparison.OrdinalIgnoreCase));
        if (documentSource is null)
            return Results.NotFound();

        var contentType = MediaTypeHeaderValue.TryParse(document.ContentType, out var parsedContentType)
            ? parsedContentType.ToString()
            : "application/octet-stream";
        var entityTag = $"\"{document.ContentHash}\"";
        httpContext.Response.Headers.CacheControl = $"private, max-age={(int)TimeSpan.FromMinutes(ContentCacheMinutes).TotalSeconds}";
        httpContext.Response.Headers.ETag = entityTag;
        httpContext.Response.Headers.XContentTypeOptions = "nosniff";
        httpContext.Response.Headers.ContentDisposition = GetContentDisposition(document, contentType, download);

        if (MatchesIfNoneMatch(httpContext, entityTag))
            return Results.StatusCode(StatusCodes.Status304NotModified);

        var cacheKey = $"document-content:{document.SourceName}:{document.SourceDocumentId}:{document.ContentHash}";
        if (cache.TryGetValue(cacheKey, out byte[]? cachedContent) && cachedContent is not null)
            return Results.Bytes(cachedContent, contentType);

        var contentStream = await documentSource.OpenAsync(document.SourceDocumentId, cancellationToken);
        var buffer = new MemoryStream();
        var chunk = new byte[81920];

        try
        {
            while (true)
            {
                var bytesRead = await contentStream.ReadAsync(chunk, cancellationToken);
                if (bytesRead == 0)
                {
                    var content = buffer.ToArray();
                    cache.Set(
                        cacheKey,
                        content,
                        new MemoryCacheEntryOptions()
                            .SetSize(content.Length)
                            .SetAbsoluteExpiration(TimeSpan.FromMinutes(ContentCacheMinutes)));
                    await contentStream.DisposeAsync();
                    buffer.Dispose();
                    return Results.Bytes(content, contentType);
                }

                await buffer.WriteAsync(chunk.AsMemory(0, bytesRead), cancellationToken);
                if (buffer.Length <= CacheableDocumentLimit)
                    continue;

                return Results.Stream(async output =>
                {
                    try
                    {
                        buffer.Position = 0;
                        await buffer.CopyToAsync(output, cancellationToken);
                        await contentStream.CopyToAsync(output, cancellationToken);
                    }
                    finally
                    {
                        await contentStream.DisposeAsync();
                        buffer.Dispose();
                    }
                }, contentType);
            }
        }
        catch
        {
            await contentStream.DisposeAsync();
            buffer.Dispose();
            throw;
        }
    }

    private static bool MatchesIfNoneMatch(HttpContext httpContext, string entityTag)
    {
        var tags = httpContext.Request.GetTypedHeaders().IfNoneMatch;
        return tags?.Any(tag =>
        {
            var value = tag.Tag.ToString();
            if (value == "*")
                return true;
            if (value.StartsWith("W/", StringComparison.OrdinalIgnoreCase))
                value = value[2..];
            return value == entityTag;
        }) == true;
    }

    private static string GetContentDisposition(SourceDocument document, string contentType, bool download)
    {
        var mediaType = contentType.Split(';', 2)[0].Trim();
        var previewable = mediaType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ||
            mediaType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase) ||
            mediaType.Equals("image/png", StringComparison.OrdinalIgnoreCase) ||
            mediaType.Equals("image/gif", StringComparison.OrdinalIgnoreCase) ||
            mediaType.Equals("image/webp", StringComparison.OrdinalIgnoreCase) ||
            mediaType.Equals("image/bmp", StringComparison.OrdinalIgnoreCase);
        var disposition = download || !previewable ? "attachment" : "inline";
        var fileName = Path.GetFileName(document.FileName.Replace('\\', '/'));
        var safeFileName = new string((fileName ?? string.Empty).Where(character => !char.IsControl(character)).ToArray());
        if (string.IsNullOrWhiteSpace(safeFileName))
            safeFileName = "document";
        var encodedFileName = Uri.EscapeDataString(safeFileName);
        return $"{disposition}; filename=\"document\"; filename*=UTF-8''{encodedFileName}";
    }
}