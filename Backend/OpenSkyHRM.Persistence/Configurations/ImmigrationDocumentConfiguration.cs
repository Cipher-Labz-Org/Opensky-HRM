using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class ImmigrationDocumentConfiguration : IEntityTypeConfiguration<ImmigrationDocument>
{
    public void Configure(EntityTypeBuilder<ImmigrationDocument> builder)
    {
        builder.ToTable("ImmigrationDocuments");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.FileName).HasMaxLength(500).IsRequired();
        builder.Property(d => d.StoredFileName).HasMaxLength(500).IsRequired();
        builder.Property(d => d.Description).HasMaxLength(1000);
        builder.Property(d => d.ContentType).HasMaxLength(200);
        builder.Property(d => d.AddedBy).HasMaxLength(200);

        builder.HasOne(d => d.Employee)
            .WithMany(e => e.ImmigrationDocuments)
            .HasForeignKey(d => d.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
