using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> builder)
    {
        builder.ToTable("SystemSettings");
        builder.HasKey(s => s.Key);
        builder.Property(s => s.Key).HasMaxLength(100);
        // Large JSON blobs (e.g. carry-forward narrative) exceed short varchar limits.
        builder.Property(s => s.Value).HasMaxLength(20000).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(500);

        builder.HasData(
            new SystemSetting
            {
                Key = "EmployeeCodeAutoGenerate",
                Value = "true",
                Description = "Whether employee codes are auto-generated (true) or manually entered (false)"
            },
            new SystemSetting
            {
                Key = "EmployeeCodeLength",
                Value = "6",
                Description = "Number of digits in the auto-generated employee code (e.g. 6 → EMP-000001)"
            },
            new SystemSetting
            {
                Key = "EmployeeCodePrefix",
                Value = "EMP",
                Description = "Prefix for auto-generated employee codes (e.g. EMP → EMP-000001)"
            }
        );
    }
}
