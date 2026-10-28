using WarrantySystem.Shared;

namespace WarrantySystem.Features.DownloadDocument;

public static class DownloadDocumentEndpoint
{
    public static IEndpointRouteBuilder MapDownloadDocument(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/warranty/v1/documents/{id}", (string id, WarrantyDocumentStore store) =>
            {
                var document = store.ById(id);
                return document is null
                    ? Results.NotFound()
                    : Results.File(document.FullPath, document.Entry.MediaType, Path.GetFileName(document.FullPath));
            })
            .RequireAuthorization()
            .WithName("DownloadWarrantyDocument")
            .WithTags("Warranty documents")
            .Produces(StatusCodes.Status200OK, contentType: "application/octet-stream")
            .Produces(StatusCodes.Status404NotFound);
        return routes;
    }
}
