using System.Net.Http.Headers;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

sealed class ClientCredential
{
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
}

sealed class AuthSettings
{
    public string Issuer { get; init; } = "sales-system";
    public int TokenLifetimeMinutes { get; init; } = 60;
    public int RequestsPerMinute { get; init; } = 60;
    public List<ClientCredential> Clients { get; init; } = [];
}

sealed class TokenIssuer(AuthSettings settings, SecurityKey signingKey)
{
    public int LifetimeSeconds => settings.TokenLifetimeMinutes * 60;

    public bool IsValidClient(string? clientId, string? clientSecret)
    {
        if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            return false;

        var client = settings.Clients.FirstOrDefault(c => c.ClientId == clientId);
        return client is not null && CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(client.ClientSecret)),
            SHA256.HashData(Encoding.UTF8.GetBytes(clientSecret)));
    }

    public string Issue(string clientId) => new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
    {
        Issuer = settings.Issuer,
        Audience = settings.Issuer,
        Subject = new ClaimsIdentity([new Claim("client_id", clientId)]),
        Expires = DateTime.UtcNow.AddSeconds(LifetimeSeconds),
        SigningCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256),
    });

    // OAuth2 lets clients send credentials in a Basic header or in the form body.
    public static (string? Id, string? Secret) ReadClient(HttpRequest request, IFormCollection form)
    {
        if (!AuthenticationHeaderValue.TryParse(request.Headers.Authorization.ToString(), out var header) ||
            !"Basic".Equals(header.Scheme, StringComparison.OrdinalIgnoreCase))
        {
            return (form["client_id"].ToString(), form["client_secret"].ToString());
        }

        try
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(header.Parameter ?? string.Empty));
            var separator = decoded.IndexOf(':');
            return separator > 0
                ? (Uri.UnescapeDataString(decoded[..separator]), Uri.UnescapeDataString(decoded[(separator + 1)..]))
                : (null, null);
        }
        catch (FormatException)
        {
            return (null, null);
        }
    }
}

static class SecurityPolicies
{
    public static void LocalhostOnly(Microsoft.AspNetCore.Cors.Infrastructure.CorsOptions options) =>
        options.AddDefaultPolicy(policy => policy
            .SetIsOriginAllowed(origin => Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.IsLoopback)
            .AllowAnyHeader()
            .WithMethods("GET", "POST"));

    // Per authenticated client, falling back to caller IP (covers the token endpoint); docs are not limited.
    public static void PerClient(Microsoft.AspNetCore.RateLimiting.RateLimiterOptions options, int requestsPerMinute)
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.OnRejected = (context, _) =>
        {
            if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
            return ValueTask.CompletedTask;
        };
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            context.Request.Path.StartsWithSegments("/swagger")
                ? RateLimitPartition.GetNoLimiter("docs")
                : RateLimitPartition.GetFixedWindowLimiter(
                    context.User.Identity?.Name ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = requestsPerMinute,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0,
                    }));
    }
}
