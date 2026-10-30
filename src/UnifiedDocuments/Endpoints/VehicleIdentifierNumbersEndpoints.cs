using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Routing;
using UnifiedDocuments.Data;

namespace UnifiedDocuments.Endpoints;

public static class VehicleIdentifierNumbersEndpoints
{
    private const int MaximumSuggestions = 10;

    public static IEndpointRouteBuilder MapVehicleIdentifierNumbersEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/vehicles/identifiers", GetVehicleIdentifierNumbers);
        return endpoints;
    }

    private static async Task<IResult> GetVehicleIdentifierNumbers(
        UnifiedDocumentsDbContext db,
        CancellationToken cancellationToken,
        string query = "")
    {
        var normalizedQuery = query.Trim().ToUpperInvariant();
        var identifiers = FindMatchingIdentifiers(db, normalizedQuery);
        var matches = await GetBestMatchingIdentifiersAsync(identifiers, normalizedQuery, cancellationToken);

        return Results.Ok(matches);
    }

    private static IQueryable<string> FindMatchingIdentifiers(
        UnifiedDocumentsDbContext db,
        string normalizedQuery)
    {
        var identifiers = db.DocumentVins.AsNoTracking()
            .Select(documentVin => documentVin.Vin)
            .Distinct();

        return normalizedQuery.Length > 0
            ? identifiers.Where(identifier => identifier.Contains(normalizedQuery))
            : identifiers;
    }

    private static Task<string[]> GetBestMatchingIdentifiersAsync(
        IQueryable<string> identifiers,
        string normalizedQuery,
        CancellationToken cancellationToken) =>
        identifiers
            .OrderBy(identifier => identifier == normalizedQuery ? 0 : identifier.StartsWith(normalizedQuery) ? 1 : 2)
            .ThenBy(identifier => identifier)
            .Take(MaximumSuggestions)
            .ToArrayAsync(cancellationToken);
}