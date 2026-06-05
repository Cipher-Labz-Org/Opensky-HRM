using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PayrollBatchConfiguration : IEntityTypeConfiguration<PayrollBatch>
{
    public void Configure(EntityTypeBuilder<PayrollBatch> builder)
    {
        builder.ToTable("PayrollBatches");
        builder.HasKey(b => b.Id);
        builder.HasIndex(b => new { b.Year, b.Month });

        builder.Property(b => b.BatchCode).HasMaxLength(50).IsRequired();
        builder.Property(b => b.ProcessType).HasConversion<string>().HasMaxLength(30);
        builder.Property(b => b.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(b => b.ApprovedBy).HasMaxLength(200);
        builder.Property(b => b.Notes).HasMaxLength(1000);
        builder.Property(b => b.TotalGross).HasColumnType("numeric(18,2)");
        builder.Property(b => b.TotalDeductions).HasColumnType("numeric(18,2)");
        builder.Property(b => b.TotalNet).HasColumnType("numeric(18,2)");
        builder.Property(b => b.TotalEmployerCost).HasColumnType("numeric(18,2)");
    }
}
