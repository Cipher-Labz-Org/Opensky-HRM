using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeDriverLicenseConfiguration : IEntityTypeConfiguration<EmployeeDriverLicense>
{
    public void Configure(EntityTypeBuilder<EmployeeDriverLicense> builder)
    {
        builder.ToTable("EmployeeDriverLicenses");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Number).HasMaxLength(50);
        builder.Property(d => d.LicenseType).HasMaxLength(80);
        builder.Property(d => d.IssuingCountry).HasMaxLength(100);

        builder.HasOne(d => d.Employee)
            .WithMany(e => e.DriverLicenses)
            .HasForeignKey(d => d.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
