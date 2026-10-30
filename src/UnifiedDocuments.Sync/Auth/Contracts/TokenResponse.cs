using System.Text.Json.Serialization;

namespace UnifiedDocuments.Sync.Auth.Contracts;

internal sealed record TokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("expires_in")] int ExpiresIn);