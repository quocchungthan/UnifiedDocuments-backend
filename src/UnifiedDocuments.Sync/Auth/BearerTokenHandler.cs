using System.Net;
using System.Net.Http.Headers;

namespace UnifiedDocuments.Sync.Auth;

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