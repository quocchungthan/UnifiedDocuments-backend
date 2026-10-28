using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace UnifiedDocuments.Data;

public static class ServiceCollectionExtensions
{
    // Keeps the database provider an implementation detail of this project.
    public static IServiceCollection AddUnifiedDocumentsData(this IServiceCollection services, string connectionString) =>
        services.AddDbContext<UnifiedDocumentsDbContext>(options => options
            .UseSqlite(connectionString)
            .UseSnakeCaseNamingConvention());
}
