using System.Net.Http.Headers;

namespace UnifiedDocuments.Sync.Auth;

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