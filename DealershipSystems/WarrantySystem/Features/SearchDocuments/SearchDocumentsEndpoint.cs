using WarrantySystem.Shared;

namespace WarrantySystem.Features.SearchDocuments;

public sealed record SearchDocumentsRequest(string? ClaimNumber, string? PageToken, int? MaxResults);

public sealed record WarrantyDocumentLinks(string Content);

public sealed record WarrantyDocumentResult(
    string Id,
    string ClaimNumber,
    string Title,
    string DocumentType,
    DateOnly IssuedOn,
    string MediaType,
    string FileName,
    WarrantyDocumentLinks Links);

public sealed record SearchDocumentsResponse(
    IReadOnlyList<WarrantyDocumentResult> Documents,
    string? NextPageToken);

public static class SearchDocumentsEndpoint
{
    private const int DefaultMaxResults = 10;
    private const int MaxResultsLimit = 30;

    public static IEndpointRouteBuilder MapSearchDocuments(this IEndpointRouteBuilder routes)
    {
        routes.MapPost("/warranty/v1/claims/documents/search", Handle)
            .WithName("SearchWarrantyDocuments")
            .WithTags("Warranty documents")
            .Produces<SearchDocumentsResponse>()
            .ProducesValidationProblem();
        return routes;
    }

    private static IResult Handle(SearchDocumentsRequest request, WarrantyDocumentStore store)
    {
        var errors = new Dictionary<string, string[]>();
        if (!PageToken.TryDecode(request.PageToken, out var offset))
            errors["PageToken"] = ["Invalid page token."];
        var maxResults = request.MaxResults ?? DefaultMaxResults;
        if (maxResults is < 1 or > MaxResultsLimit)
            errors["MaxResults"] = [$"Must be between 1 and {MaxResultsLimit}."];
        if (errors.Count > 0)
            return Results.ValidationProblem(errors);

        var matches = store.Find(request.ClaimNumber);
        var page = matches.Skip(offset).Take(maxResults)
            .Select(d => new WarrantyDocumentResult(
                d.Entry.Id,
                d.Entry.ClaimNumber,
                d.Entry.Title,
                d.Entry.DocumentType,
                d.Entry.IssuedOn,
                d.Entry.MediaType,
                Path.GetFileName(d.FullPath),
                new WarrantyDocumentLinks($"/warranty/v1/documents/{d.Entry.Id}")))
            .ToList();

        var nextOffset = offset + maxResults;
        return Results.Ok(new SearchDocumentsResponse(
            page,
            nextOffset < matches.Count ? PageToken.Encode(nextOffset) : null));
    }
}
