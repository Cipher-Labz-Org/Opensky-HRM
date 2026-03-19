using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class BiometricDeviceConfiguration : IEntityTypeConfiguration<BiometricDevice>
{
    public void Configure(EntityTypeBuilder<BiometricDevice> builder)
    {
        builder.ToTable("BiometricDevices");
        builder.HasKey(b => b.Id);
        builder.Property(b => b.Name).IsRequired().HasMaxLength(200);
        builder.Property(b => b.SerialNumber).IsRequired().HasMaxLength(100);
        builder.Property(b => b.Location).HasMaxLength(200);
        builder.Property(b => b.DeviceType).IsRequired().HasMaxLength(50);
        builder.HasIndex(b => b.SerialNumber).IsUnique();
    }
}
