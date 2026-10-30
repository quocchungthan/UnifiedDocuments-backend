using System.Security.Cryptography;
using System.Text.Json;
using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Polly.Timeout;
using UnifiedDocuments.Contracts;
using UnifiedDocuments.Data;
using UnifiedDocuments.Data.Entities;
using UnifiedDocuments.Models;
using UnifiedDocuments.Sync.Sources;
using UnifiedDocuments.Sync.Extraction;

namespace UnifiedDocuments.Endpoints;

public static class VehicleDocumentsEndpoints
{
    private const int CacheableDocumentLimit = 10 * 1024 * 1024;
    private const int ContentCacheMinutes = 15;
    private const int DefaultUnlinkedPageSize = 50;
    private const int MaximumUnlinkedPageSize = 100;

    public static IEndpointRouteBuilder MapVehicleDocumentsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/vehicles/{vin}/documents", GetDocumentsByVin);
        endpoints.MapGet("/documents/unlinked", GetUnlinkedDocuments);
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
            return Results.BadRequest(new ValidationError("VIN must be 17 characters and cannot contain I, O or Q."));

        return await GetDocumentList(
            db.SourceDocuments.Where(document => document.Vins.Any(link => link.Vin == normalizedVin)),
            httpContext,
            cancellationToken);
    }

    private static async Task<IResult> GetUnlinkedDocuments(
        UnifiedDocumentsDbContext db,
        HttpContext httpContext,
        CancellationToken cancellationToken,
        string? cursor = null,
        int pageSize = DefaultUnlinkedPageSize)
    {
        if (pageSize is < 1 or > MaximumUnlinkedPageSize)
            return Results.BadRequest(new ValidationError($"Page size must be between 1 and {MaximumUnlinkedPageSize}."));

        if (!TryParseDocumentCursor(cursor, out var after))
            return Results.BadRequest(new ValidationError("Invalid document cursor."));

        var page = await GetUnlinkedDocumentPageAsync(db, after, pageSize, cancellationToken);
        return CachedJson(page, httpContext);
    }

    private static bool TryParseDocumentCursor(string? cursor, out DocumentCursor? after)
    {
        after = null;
        if (cursor is null)
            return true;
        if (cursor.Length is 0 or > 256)
            return false;

        try
        {
            after = JsonSerializer.Deserialize<DocumentCursor>(WebEncoders.Base64UrlDecode(cursor));
            return after is not null && after.Id > 0 && after.Date != default;
        }
        catch (Exception exception) when (exception is FormatException or JsonException)
        {
            return false;
        }
    }

    private static IQueryable<SourceDocument> FindUnlinkedDocuments(
        UnifiedDocumentsDbContext db,
        DocumentCursor? after)
    {
        var query = db.SourceDocuments.AsNoTracking().Where(document => !document.Vins.Any());
        if (after is not null)
        {
            var date = after.Date;
            var id = after.Id;
            query = query.Where(document =>
                (document.ModifiedAt ?? document.IndexedAt) < date ||
                ((document.ModifiedAt ?? document.IndexedAt) == date && document.Id < id));
        }

        return query;
    }

    private static async Task<DocumentPage> GetUnlinkedDocumentPageAsync(
        UnifiedDocumentsDbContext db,
        DocumentCursor? after,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var documents = await FindUnlinkedDocuments(db, after)
            .OrderByDescending(document => document.ModifiedAt ?? document.IndexedAt)
            .ThenByDescending(document => document.Id)
            .Take(pageSize + 1)
            .ToListAsync(cancellationToken);

        return CreateDocumentPage(documents, pageSize);
    }

    private static DocumentPage CreateDocumentPage(IReadOnlyCollection<SourceDocument> documents, int pageSize)
    {
        var hasMore = documents.Count > pageSize;
        var page = documents.Take(pageSize).ToArray();
        var last = page.LastOrDefault();
        var nextCursor = hasMore && last is not null
            ? WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(
                new DocumentCursor(last.ModifiedAt ?? last.IndexedAt, last.Id)))
            : null;

        return new DocumentPage(page.Select(ToMetadata).ToArray(), nextCursor);
    }

    private static DocumentMetadata ToMetadata(SourceDocument document) => new(
        document.SourceName, document.SourceDocumentId, document.FileName,
        document.ContentType, document.BusinessKey, document.ModifiedAt);

    private static async Task<IResult> GetDocumentList(
        IQueryable<SourceDocument> query,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var documents = await query.AsNoTracking()
            .OrderByDescending(document => document.ModifiedAt ?? document.IndexedAt)
            .ThenBy(document => document.SourceName)
            .ThenBy(document => document.SourceDocumentId)
            .ToListAsync(cancellationToken);

        return CachedJson(documents.Select(ToMetadata), httpContext);
    }

    private static IResult CachedJson(object body, HttpContext httpContext)
    {
        var responseBody = JsonSerializer.SerializeToUtf8Bytes(body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
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
        ILoggerFactory loggerFactory,
        bool download = false)
    {
        var logger = loggerFactory.CreateLogger(nameof(VehicleDocumentsEndpoints));
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

        var contentType = GetDocumentContentType(document.ContentType);
        SetContentResponseHeaders(httpContext, document, contentType, download);

        var cacheKey = $"document-content:{document.SourceName}:{document.SourceDocumentId}:{document.ContentHash}";
        if (cache.TryGetValue(cacheKey, out CachedDocumentContent? cachedContent) && cachedContent is not null)
            return CreateCachedContentResponse(cachedContent, contentType, httpContext);

        Stream contentStream;
        try
        {
            contentStream = await documentSource.OpenAsync(document.SourceDocumentId, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            return MapUpstreamFailure(exception, document.SourceName, logger);
        }
        catch (TimeoutRejectedException exception)
        {
            return MapUpstreamTimeout(exception, document.SourceName, logger);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            return MapUpstreamTimeout(exception, document.SourceName, logger);
        }

        return await ReadAndCacheDocumentContentAsync(
            contentStream, cacheKey, contentType, document.SourceName, cache, httpContext, logger, cancellationToken);
    }

    private static string GetDocumentContentType(string contentType) =>
        MediaTypeHeaderValue.TryParse(contentType, out var parsedContentType)
            ? parsedContentType.ToString()
            : "application/octet-stream";

    private static void SetContentResponseHeaders(
        HttpContext httpContext,
        SourceDocument document,
        string contentType,
        bool download)
    {
        httpContext.Response.Headers.CacheControl = $"private, max-age={(int)TimeSpan.FromMinutes(ContentCacheMinutes).TotalSeconds}";
        httpContext.Response.Headers.XContentTypeOptions = "nosniff";
        httpContext.Response.Headers.ContentDisposition = GetContentDisposition(document, contentType, download);
    }

    private static IResult CreateCachedContentResponse(
        CachedDocumentContent cachedContent,
        string contentType,
        HttpContext httpContext)
    {
        var cachedTag = $"\"{cachedContent.ContentHash}\"";
        httpContext.Response.Headers.ETag = cachedTag;
        if (MatchesIfNoneMatch(httpContext, cachedTag))
            return Results.StatusCode(StatusCodes.Status304NotModified);
        return Results.Bytes(cachedContent.Content, contentType);
    }

    private static async Task<IResult> ReadAndCacheDocumentContentAsync(
        Stream contentStream,
        string cacheKey,
        string contentType,
        string sourceName,
        IMemoryCache cache,
        HttpContext httpContext,
        ILogger logger,
        CancellationToken cancellationToken)
    {
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
                    var contentHash = Convert.ToHexStringLower(SHA256.HashData(content));
                    var entityTag = $"\"{contentHash}\"";
                    httpContext.Response.Headers.ETag = entityTag;
                    if (MatchesIfNoneMatch(httpContext, entityTag))
                    {
                        await contentStream.DisposeAsync();
                        buffer.Dispose();
                        return Results.StatusCode(StatusCodes.Status304NotModified);
                    }

                    cache.Set(
                        cacheKey,
                        new CachedDocumentContent(content, contentHash),
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

                httpContext.Response.Headers.Remove("ETag");
                return CreateStreamingContentResponse(contentStream, buffer, contentType, cancellationToken);
            }
        }
        catch (HttpRequestException exception)
        {
            await contentStream.DisposeAsync();
            buffer.Dispose();
            return MapUpstreamFailure(exception, sourceName, logger);
        }
        catch (TimeoutRejectedException exception)
        {
            await contentStream.DisposeAsync();
            buffer.Dispose();
            return MapUpstreamTimeout(exception, sourceName, logger);
        }
        catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            await contentStream.DisposeAsync();
            buffer.Dispose();
            return MapUpstreamTimeout(exception, sourceName, logger);
        }
        catch
        {
            await contentStream.DisposeAsync();
            buffer.Dispose();
            throw;
        }
    }

    private static IResult CreateStreamingContentResponse(
        Stream contentStream,
        MemoryStream buffer,
        string contentType,
        CancellationToken cancellationToken) =>
        Results.Stream(async output =>
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

    private static IResult MapUpstreamFailure(
        HttpRequestException exception,
        string sourceName,
        ILogger logger)
    {
        if (exception.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogInformation(exception, "Document content is missing from source {Source}.", sourceName);
            return Results.NotFound();
        }

        var statusCode = exception.StatusCode switch
        {
            HttpStatusCode.TooManyRequests => StatusCodes.Status503ServiceUnavailable,
            >= HttpStatusCode.InternalServerError => StatusCodes.Status503ServiceUnavailable,
            null => StatusCodes.Status503ServiceUnavailable,
            _ => StatusCodes.Status502BadGateway,
        };
        logger.LogWarning(exception, "Document source {Source} failed while retrieving content.", sourceName);
        return Results.Problem(
            statusCode: statusCode,
            title: statusCode == StatusCodes.Status503ServiceUnavailable
                ? "The document source is temporarily unavailable."
                : "The document source rejected the request.");
    }

    private static IResult MapUpstreamTimeout(Exception exception, string sourceName, ILogger logger)
    {
        logger.LogWarning(exception, "Timed out while retrieving content from source {Source}.", sourceName);
        return Results.Problem(
            statusCode: StatusCodes.Status504GatewayTimeout,
            title: "The document source did not respond in time.");
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