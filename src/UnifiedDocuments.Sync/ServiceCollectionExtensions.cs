using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using UnifiedDocuments.Sync.Auth;
using UnifiedDocuments.Sync.Extraction;
using UnifiedDocuments.Sync.Sources;

namespace UnifiedDocuments.Sync;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddUnifiedDocumentsSync(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SyncOptions>(configuration.GetSection("Sync"));
        var systems = configuration.GetSection("DealershipSystems").Get<DealershipSystemsOptions>()
            ?? throw new InvalidOperationException("Section 'DealershipSystems' is not configured.");

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<TextExtractor>();
        services.AddScoped<DocumentSynchronizer>();
        services.AddHostedService<DocumentSyncWorker>();

        AddOAuthSource<SalesDocumentSource>(services, "Sales", systems.Sales, "connect/token");
        AddOAuthSource<ServiceDocumentSource>(services, "Service", systems.Service, "oauth2/token");

        services.AddHttpClient<WarrantyDocumentSource>(http => http.BaseAddress = WithTrailingSlash(systems.Warranty.BaseUrl))
            .AddHttpMessageHandler(() => new BasicAuthHandler(systems.Warranty.Username, systems.Warranty.Password))
            .AddStandardResilienceHandler(ConfigureResilience);
        services.AddTransient<IDocumentSource>(sp => sp.GetRequiredService<WarrantyDocumentSource>());

        return services;
    }

    private static void AddOAuthSource<TSource>(IServiceCollection services, string name, OAuthSourceOptions options, string tokenPath)
        where TSource : class, IDocumentSource
    {
        var tokenClientName = $"{name}.Token";
        services.AddHttpClient(tokenClientName, http => http.BaseAddress = WithTrailingSlash(options.BaseUrl))
            .AddStandardResilienceHandler(ConfigureResilience);
        services.AddKeyedSingleton(name, (sp, _) => new ClientCredentialsTokenProvider(
            sp.GetRequiredService<IHttpClientFactory>().CreateClient(tokenClientName),
            tokenPath,
            options.ClientId,
            options.ClientSecret));

        services.AddHttpClient<TSource>(http => http.BaseAddress = WithTrailingSlash(options.BaseUrl))
            .AddHttpMessageHandler(sp => new BearerTokenHandler(sp.GetRequiredKeyedService<ClientCredentialsTokenProvider>(name)))
            .AddStandardResilienceHandler(ConfigureResilience);
        services.AddTransient<IDocumentSource>(sp => sp.GetRequiredService<TSource>());
    }

    // Sources rate-limit with Retry-After up to a minute; the default 30 s total timeout would give up first.
    private static void ConfigureResilience(HttpStandardResilienceOptions options)
    {
        options.Retry.MaxRetryAttempts = 3;
        options.Retry.ShouldRetryAfterHeader = true;
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(30);
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromMinutes(2);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromMinutes(4);
    }

    private static Uri WithTrailingSlash(Uri uri) =>
        uri.AbsoluteUri.EndsWith('/') ? uri : new Uri(uri.AbsoluteUri + "/");
}
