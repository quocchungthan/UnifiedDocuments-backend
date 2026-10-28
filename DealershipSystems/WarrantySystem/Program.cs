using Microsoft.AspNetCore.Authentication;
using Microsoft.OpenApi;
using WarrantySystem.Features.DownloadDocument;
using WarrantySystem.Features.SearchDocuments;
using WarrantySystem.Shared;

var builder = WebApplication.CreateBuilder(args);

var auth = builder.Configuration.GetSection("Auth").Get<AuthSettings>() ?? new AuthSettings();
if (auth.Users.Count == 0)
    throw new InvalidOperationException("Configure at least one user under Auth:Users.");

builder.Services.AddSingleton(auth);
builder.Services
    .AddAuthentication(BasicAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, BasicAuthenticationHandler>(BasicAuthenticationHandler.SchemeName, null);
builder.Services.AddAuthorization();
builder.Services.AddCors(SecurityPolicies.LocalhostOnly);
builder.Services.AddRateLimiter(options => SecurityPolicies.PerUser(options, auth.RequestsPerMinute));

// Legacy contract: PascalCase JSON property names.
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.PropertyNamingPolicy = null);
builder.Services.AddOpenApi(options => options.AddDocumentTransformer((document, _, _) =>
{
    document.Components ??= new OpenApiComponents();
    document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
    document.Components.SecuritySchemes["basic"] = new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "basic" };
    document.Security ??= [];
    document.Security.Add(new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("basic", document)] = [] });
    return Task.CompletedTask;
}));
builder.Services.AddSingleton(sp =>
    WarrantyDocumentStore.Load(Path.Combine(sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "Documents")));

var app = builder.Build();
app.MapOpenApi();
app.UseSwaggerUI(options => options.SwaggerEndpoint("/openapi/v1.json", "Warranty System v1"));
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapSearchDocuments();
app.MapDownloadDocument();

app.Run();
