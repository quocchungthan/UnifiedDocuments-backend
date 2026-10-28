using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace UnifiedDocuments.Sync.Auth;

// One instance per source, so the cached token survives HttpClient handler rotation.
public sealed class ClientCredentialsTokenProvider(HttpClient tokenClient, string tokenPath, string clientId, string clientSecret)
{
    private readonly SemaphoreSlim _lock = new(1, 1);
    private string? _token;
    private DateTimeOffset _expiresAt;

    public async Task<string> GetTokenAsync(bool forceRefresh, CancellationToken cancellationToken)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (forceRefresh || _token is null || DateTimeOffset.UtcNow >= _expiresAt)
            {
                using var response = await tokenClient.PostAsync(tokenPath, new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = clientId,
                    ["client_secret"] = clientSecret,
                }), cancellationToken);
                response.EnsureSuccessStatusCode();

                var token = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken)
                    ?? throw new InvalidOperationException($"Empty token response from {tokenPath}.");
                _token = token.AccessToken;
                _expiresAt = DateTimeOffset.UtcNow.AddSeconds(Math.Max(0, token.ExpiresIn - 60));
            }

            return _token;
        }
        finally
        {
            _lock.Release();
        }
    }

    private sealed record TokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}

public sealed class BearerTokenHandler(ClientCredentialsTokenProvider tokens) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetTokenAsync(false, cancellationToken));
        var response = await base.SendAsync(request, cancellationToken);
        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        // Source restarts invalidate issued tokens; fetch a fresh one and retry once.
        response.Dispose();
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", await tokens.GetTokenAsync(true, cancellationToken));
        return await base.SendAsync(request, cancellationToken);
    }
}

public sealed class BasicAuthHandler(string username, string password) : DelegatingHandler
{
    private readonly AuthenticationHeaderValue _header = new(
        "Basic", Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{username}:{password}")));

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Headers.Authorization = _header;
        return base.SendAsync(request, cancellationToken);
    }
}
