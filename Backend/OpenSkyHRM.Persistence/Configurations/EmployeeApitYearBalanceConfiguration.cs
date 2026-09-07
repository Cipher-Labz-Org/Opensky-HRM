using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeApitYearBalanceConfiguration : IEntityTypeConfiguration<EmployeeApitYearBalance>
{
    public void Configure(EntityTypeBuilder<EmployeeApitYearBalance> builder)
    {
        builder.ToTable("EmployeeApitYearBalances");
        builder.HasKey(b => b.Id);

        builder.HasIndex(b => new { b.EmployeeId, b.TaxYearStartYear })
            .IsUnique()
            .HasFilter("\"IsDeleted\" = FALSE");

        builder.Property(b => b.CumulativeTaxable).HasColumnType("numeric(18,2)");
        builder.Property(b => b.CumulativeApit).HasColumnType("numeric(18,2)");

        builder.HasOne(b => b.Employee)
            .WithMany()
            .HasForeignKey(b => b.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
