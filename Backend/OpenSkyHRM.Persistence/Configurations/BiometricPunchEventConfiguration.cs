using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class BiometricPunchEventConfiguration : IEntityTypeConfiguration<BiometricPunchEvent>
{
    public void Configure(EntityTypeBuilder<BiometricPunchEvent> builder)
    {
        builder.ToTable("BiometricPunchEvents");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.DeviceUserId).IsRequired().HasMaxLength(100);
        builder.Property(x => x.PunchState).HasMaxLength(50);
        builder.Property(x => x.VerifyMode).HasMaxLength(50);
        builder.Property(x => x.ExternalLogId).HasMaxLength(100);
        builder.Property(x => x.DedupeHash).IsRequired().HasMaxLength(128);

        builder.HasIndex(x => x.DedupeHash).IsUnique();
        builder.HasIndex(x => x.PunchAtUtc);
        builder.HasIndex(x => new { x.DeviceId, x.DeviceUserId, x.PunchAtUtc });

        builder.HasOne(x => x.Device)
            .WithMany()
            .HasForeignKey(x => x.DeviceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.RawEvent)
            .WithMany()
            .HasForeignKey(x => x.RawEventId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

