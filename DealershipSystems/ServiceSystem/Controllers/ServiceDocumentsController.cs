using Microsoft.AspNetCore.Mvc;
using ServiceSystem.Application;

namespace ServiceSystem.Controllers;

public sealed record ServiceDocumentDto(
    string RecordId,
    string DocumentKind,
    string FileName,
    string MimeType,
    long ByteSize,
    DateTimeOffset UploadedAt,
    string ContentHref);

public sealed record PageMeta(int Offset, int Limit, int Total);

public sealed record PageLinks(string Self, string? Next, string? Prev);

public sealed record ServiceDocumentListResponse(IReadOnlyList<ServiceDocumentDto> Data, PageMeta Meta, PageLinks Links);

[ApiController]
[Route("service-api/v2/documents")]
[Produces("application/json")]
public sealed class ServiceDocumentsController(ServiceDocumentQueryService queries) : ControllerBase
{
    private const string BasePath = "/service-api/v2/documents";

    [HttpGet]
    [ProducesResponseType<ServiceDocumentListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public ActionResult<ServiceDocumentListResponse> List(
        [FromQuery(Name = "offset")] int offset = 0,
        [FromQuery(Name = "limit")] int limit = 25)
    {
        if (offset < 0)
            ModelState.AddModelError("offset", "offset must be >= 0.");
        if (limit is < 1 or > ServiceDocumentQueryService.MaxLimit)
            ModelState.AddModelError("limit", $"limit must be between 1 and {ServiceDocumentQueryService.MaxLimit}.");
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var page = queries.List(offset, limit);
        var data = page.Items
            .Select(d => new ServiceDocumentDto(
                d.RecordId, d.DocumentKind, d.FileName, d.MimeType, d.ByteSize, d.UploadedAt,
                $"{BasePath}/{d.RecordId}/file"))
            .ToList();

        var links = new PageLinks(
            Link(offset, limit),
            offset + limit < page.Total ? Link(offset + limit, limit) : null,
            offset > 0 ? Link(Math.Max(0, offset - limit), limit) : null);

        return Ok(new ServiceDocumentListResponse(data, new PageMeta(offset, limit, page.Total), links));
    }

    [HttpGet("{recordId}/file")]
    [Produces("application/octet-stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult Download(string recordId)
    {
        var document = queries.Get(recordId);
        return document is null
            ? NotFound()
            : PhysicalFile(document.PhysicalPath, document.MimeType, document.FileName);
    }

    private static string Link(int offset, int limit) => $"{BasePath}?offset={offset}&limit={limit}";
}
