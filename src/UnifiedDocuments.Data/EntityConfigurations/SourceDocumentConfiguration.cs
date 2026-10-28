using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnifiedDocuments.Data.Entities;

namespace UnifiedDocuments.Data.EntityConfigurations;

internal sealed class SourceDocumentConfiguration : IEntityTypeConfiguration<SourceDocument>
{
    public void Configure(EntityTypeBuilder<SourceDocument> builder)
    {
        builder.ToTable("source_documents");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.SourceName).HasMaxLength(64);
        builder.Property(d => d.SourceDocumentId).HasMaxLength(256);
        builder.Property(d => d.FileName).HasMaxLength(512);
        builder.Property(d => d.ContentType).HasMaxLength(128);
        builder.Property(d => d.BusinessKey).HasMaxLength(128);
        builder.Property(d => d.ContentHash).HasMaxLength(64);

        builder.HasIndex(d => new { d.SourceName, d.SourceDocumentId }).IsUnique();
        builder.HasIndex(d => new { d.SourceName, d.LastSeenAt });

        builder.HasMany(d => d.Vins)
            .WithOne(v => v.SourceDocument)
            .HasForeignKey(v => v.SourceDocumentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
