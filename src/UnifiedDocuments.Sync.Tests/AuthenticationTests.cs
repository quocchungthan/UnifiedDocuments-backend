using System.Net;
using System.Net.Http.Headers;
using System.Text;
using UnifiedDocuments.Sync.Auth;

namespace UnifiedDocuments.Sync.Tests;

public sealed class AuthenticationTests
{
    [Fact]
    public async Task GetToken_ValidCachedTokenAndForcedRefresh_ReusesTokenUntilRefreshRequestedAsync()
    {
        var requests = 0;
        using var handler = new StubHttpMessageHandler(async (request, cancellationToken) =>
        {
            requests++;
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/connect/token", request.RequestUri?.AbsolutePath);
            Assert.Equal("application/x-www-form-urlencoded", request.Content?.Headers.ContentType?.MediaType);
            Assert.Equal("grant_type=client_credentials&client_id=test-client&client_secret=test-secret",
                await request.Content!.ReadAsStringAsync(cancellationToken));
            return StubHttpMessageHandler.JsonResponse($$"""{"access_token":"token-{{requests}}","expires_in":3600}""");
        });
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://auth.test/") };
        var provider = new ClientCredentialsTokenProvider(http, "connect/token", "test-client", "test-secret");

        Assert.Equal("token-1", await provider.GetTokenAsync(false, CancellationToken.None));
        Assert.Equal("token-1", await provider.GetTokenAsync(false, CancellationToken.None));
        Assert.Equal(1, requests);
        Assert.Equal("token-2", await provider.GetTokenAsync(true, CancellationToken.None));
        Assert.Equal(2, requests);
    }

    [Fact]
    public async Task GetToken_NullResponse_ThrowsAndAllowsSubsequentRequestAsync()
    {
        var requests = 0;
        using var handler = new StubHttpMessageHandler((request, cancellationToken) =>
            Task.FromResult(StubHttpMessageHandler.JsonResponse(++requests == 1
                ? "null"
                : """{"access_token":"recovered","expires_in":3600}""")));
        using var http = new HttpClient(handler) { BaseAddress = new Uri("http://auth.test/") };
        var provider = new ClientCredentialsTokenProvider(http, "connect/token", "test-client", "test-secret");

        await Assert.ThrowsAsync<InvalidOperationException>(() => provider.GetTokenAsync(false, CancellationToken.None));

        Assert.Equal("recovered", await provider.GetTokenAsync(false, CancellationToken.None));
        Assert.Equal(2, requests);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK)]
    [InlineData(HttpStatusCode.Unauthorized)]
    public async Task Send_UnauthorizedResponse_RefreshesTokenAndRetriesOnlyOnceAsync(HttpStatusCode retryStatus)
    {
        var tokenRequests = 0;
        using var tokenHandler = new StubHttpMessageHandler((request, cancellationToken) =>
            Task.FromResult(StubHttpMessageHandler.JsonResponse($$"""{"access_token":"token-{{++tokenRequests}}","expires_in":3600}""")));
        using var tokenClient = new HttpClient(tokenHandler) { BaseAddress = new Uri("http://auth.test/") };
        var provider = new ClientCredentialsTokenProvider(tokenClient, "connect/token", "test-client", "test-secret");
        var sourceRequests = 0;
        using var sourceHandler = new StubHttpMessageHandler((request, cancellationToken) =>
        {
            sourceRequests++;
            Assert.Equal(new AuthenticationHeaderValue("Bearer", $"token-{sourceRequests}"), request.Headers.Authorization);
            return Task.FromResult(new HttpResponseMessage(sourceRequests == 1 ? HttpStatusCode.Unauthorized : retryStatus));
        });
        using var bearer = new BearerTokenHandler(provider) { InnerHandler = sourceHandler };
        using var http = new HttpClient(bearer);

        using var response = await http.GetAsync("http://source.test/documents");

        Assert.Equal(retryStatus, response.StatusCode);
        Assert.Equal(2, sourceRequests);
        Assert.Equal(2, tokenRequests);
    }

    [Fact]
    public async Task Send_BasicCredentials_SetsEncodedAuthorizationHeaderAsync()
    {
        using var handler = new StubHttpMessageHandler((request, cancellationToken) =>
        {
            var expected = Convert.ToBase64String(Encoding.UTF8.GetBytes("test-user:test-password"));
            Assert.Equal(new AuthenticationHeaderValue("Basic", expected), request.Headers.Authorization);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        });
        using var basic = new BasicAuthHandler("test-user", "test-password") { InnerHandler = handler };
        using var http = new HttpClient(basic);

        using var response = await http.GetAsync("http://source.test/documents");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}