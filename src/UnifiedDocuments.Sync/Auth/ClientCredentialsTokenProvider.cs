using System.Net.Http.Json;
using UnifiedDocuments.Sync.Auth.Contracts;

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
                var token = await RequestTokenAsync(cancellationToken);
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

    private async Task<TokenResponse> RequestTokenAsync(CancellationToken cancellationToken)
    {
        using var response = await tokenClient.PostAsync(tokenPath, new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
        }), cancellationToken);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken)
            ?? throw new InvalidOperationException($"Empty token response from {tokenPath}.");
    }
}