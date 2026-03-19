using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeBenefitConfiguration : IEntityTypeConfiguration<EmployeeBenefit>
{
    public void Configure(EntityTypeBuilder<EmployeeBenefit> builder)
    {
        builder.ToTable("EmployeeBenefits");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.InsuranceProvider).HasMaxLength(255);

        builder.HasOne(b => b.Employee)
            .WithOne(e => e.Benefit)
            .HasForeignKey<EmployeeBenefit>(b => b.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
