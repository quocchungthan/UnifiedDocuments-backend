using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using ServiceSystem.Application;
using ServiceSystem.Infrastructure;

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

builder.Services
    .AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower);
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
                TokenUrl = new Uri("/oauth2/token", UriKind.Relative),
                Scopes = new Dictionary<string, string>(),
            },
        },
    });
    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("oauth2", document)] = [],
    });
});

builder.Services.AddSingleton<IServiceDocumentRepository>(sp =>
    new FileSystemServiceDocumentRepository(Path.Combine(sp.GetRequiredService<IWebHostEnvironment>().ContentRootPath, "Documents")));
builder.Services.AddScoped<ServiceDocumentQueryService>();

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.MapControllers();
app.Run();
