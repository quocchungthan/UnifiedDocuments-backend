using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using UnifiedDocuments.Data.Entities;

namespace UnifiedDocuments.Data.EntityConfigurations;

internal sealed class DocumentVinConfiguration : IEntityTypeConfiguration<DocumentVin>
{
    public void Configure(EntityTypeBuilder<DocumentVin> builder)
    {
        builder.ToTable("document_vins");
        builder.HasKey(v => new { v.SourceDocumentId, v.Vin });

        builder.Property(v => v.Vin).HasMaxLength(17).IsFixedLength();

        builder.HasIndex(v => v.Vin);
    }
}
