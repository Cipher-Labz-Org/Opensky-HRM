using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PunchImportBatchConfiguration : IEntityTypeConfiguration<PunchImportBatch>
{
    public void Configure(EntityTypeBuilder<PunchImportBatch> builder)
    {
        builder.ToTable("PunchImportBatches");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.FileName).IsRequired().HasMaxLength(500);
        builder.Property(b => b.Status).IsRequired().HasMaxLength(50);
        builder.HasOne(b => b.Device)
            .WithMany()
            .HasForeignKey(b => b.DeviceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
