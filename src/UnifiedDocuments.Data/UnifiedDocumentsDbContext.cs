using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using UnifiedDocuments.Data.Entities;

namespace UnifiedDocuments.Data;

public class UnifiedDocumentsDbContext(DbContextOptions<UnifiedDocumentsDbContext> options) : DbContext(options)
{
    public DbSet<SourceDocument> SourceDocuments => Set<SourceDocument>();
    public DbSet<DocumentVin> DocumentVins => Set<DocumentVin>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(UnifiedDocumentsDbContext).Assembly);

    // SQLite cannot compare or ORDER BY DateTimeOffset; store as sortable binary instead.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        if (Database.IsSqlite())
            configurationBuilder.Properties<DateTimeOffset>().HaveConversion<DateTimeOffsetToBinaryConverter>();
    }
}
