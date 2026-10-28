using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using UnifiedDocuments.Data;
using UnifiedDocuments.Sync.Extraction;

namespace UnifiedDocuments.Endpoints;

public static class VehicleDocumentsEndpoints
{
    public static IEndpointRouteBuilder MapVehicleDocumentsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/vehicles/{vin}/documents", GetDocumentsByVin);
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
}