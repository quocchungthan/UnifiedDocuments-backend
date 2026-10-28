using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

var auth = builder.Configuration.GetSection("Auth").Get<AuthSettings>() ?? new AuthSettings();
if (auth.Clients.Count == 0)
    throw new InvalidOperationException("Configure at least one client under Auth:Clients.");
// Per-process key: issued tokens stop working after a restart.
var signingKey = new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(32));

builder.Services.AddSingleton(new TokenIssuer(auth, signingKey));
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = auth.Issuer,
        ValidAudience = auth.Issuer,
        IssuerSigningKey = signingKey,
        NameClaimType = "client_id",
    });
builder.Services.AddAuthorization();
builder.Services.AddCors(SecurityPolicies.LocalhostOnly);
builder.Services.AddRateLimiter(options => SecurityPolicies.PerClient(options, auth.RequestsPerMinute));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("oauth2", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.OAuth2,
        Flows = new OpenApiOAuthFlows
        {
            ClientCredentials = new OpenApiOAuthFlow
            {
                TokenUrl = new Uri("/connect/token", UriKind.Relative),
                Scopes = new Dictionary<string, string>(),
            },
        },
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("oauth2", document)] = [],
    });
});

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

var documentsRoot = Path.Combine(app.Environment.ContentRootPath, "Documents");
var contentTypes = new FileExtensionContentTypeProvider();

app.MapPost("/connect/token", async (HttpRequest request, TokenIssuer issuer) =>
{
    if (!request.HasFormContentType)
        return Results.Json(new { error = "invalid_request" }, statusCode: StatusCodes.Status400BadRequest);

    var form = await request.ReadFormAsync();
    if (form["grant_type"] != "client_credentials")
        return Results.Json(new { error = "unsupported_grant_type" }, statusCode: StatusCodes.Status400BadRequest);

    var (clientId, clientSecret) = TokenIssuer.ReadClient(request, form);
    if (!issuer.IsValidClient(clientId, clientSecret))
        return Results.Json(new { error = "invalid_client" }, statusCode: StatusCodes.Status401Unauthorized);

    return Results.Json(new { access_token = issuer.Issue(clientId!), token_type = "Bearer", expires_in = issuer.LifetimeSeconds });
})
.AllowAnonymous()
.ExcludeFromDescription();

var api = app.MapGroup("/api/v1").RequireAuthorization();

api.MapGet("/documents", (int? page, int? pageSize) =>
{
    var pageNumber = page ?? 1;
    var size = pageSize ?? 20;
    if (pageNumber < 1 || size is < 1 or > 100)
        return Results.Problem("page must be >= 1 and pageSize must be between 1 and 100.", statusCode: StatusCodes.Status400BadRequest);

    var files = ListFiles();
    var skip = (int)Math.Min((long)(pageNumber - 1) * size, files.Count);
    var items = files.Skip(skip).Take(size).Select(ToDocument).ToList();

    return Results.Ok(new SalesDocumentPage(
        pageNumber,
        size,
        files.Count,
        (int)Math.Ceiling(files.Count / (double)size),
        items));
})
.WithName("ListDocuments")
.WithTags("Documents")
.Produces<SalesDocumentPage>()
.ProducesProblem(StatusCodes.Status400BadRequest);

api.MapGet("/documents/{documentId}/content", (string documentId) =>
{
    var file = ListFiles().FirstOrDefault(f => DocumentId(f) == documentId);
    return file is null
        ? Results.NotFound()
        : Results.File(file, ContentType(file), Path.GetFileName(file));
})
.WithName("DownloadDocument")
.WithTags("Documents")
.Produces(StatusCodes.Status200OK, contentType: "application/octet-stream")
.Produces(StatusCodes.Status404NotFound);

app.Run();

// Ordinal ordering keeps paging stable across requests.
List<string> ListFiles() =>
    Directory.Exists(documentsRoot)
        ? Directory.EnumerateFiles(documentsRoot, "*", SearchOption.AllDirectories)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToList()
        : [];

string RelativePath(string file) =>
    Path.GetRelativePath(documentsRoot, file).Replace('\\', '/');

string DocumentId(string file) =>
    Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(RelativePath(file))))[..16];

string ContentType(string file) =>
    contentTypes.TryGetContentType(file, out var type) ? type : "application/octet-stream";

SalesDocument ToDocument(string file)
{
    var info = new FileInfo(file);
    var segments = RelativePath(file).Split('/');
    var id = DocumentId(file);

    return new SalesDocument(
        id,
        segments.Length > 1 ? segments[0] : null,
        segments.Length > 2 ? segments[1] : "general",
        info.Name,
        ContentType(file),
        info.Length,
        info.LastWriteTimeUtc,
        $"/api/v1/documents/{id}/content");
}

record SalesDocument(
    string DocumentId,
    string? DealNumber,
    string Category,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset LastModifiedUtc,
    string DownloadUrl);

record SalesDocumentPage(
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    IReadOnlyList<SalesDocument> Items);
