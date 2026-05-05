using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class BiometricRawEventConfiguration : IEntityTypeConfiguration<BiometricRawEvent>
{
    public void Configure(EntityTypeBuilder<BiometricRawEvent> builder)
    {
        builder.ToTable("BiometricRawEvents");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.EventType).IsRequired().HasMaxLength(32);
        builder.Property(x => x.Payload).IsRequired();
        builder.Property(x => x.SourceIp).HasMaxLength(64);
        builder.Property(x => x.ParseStatus).IsRequired().HasMaxLength(24);
        builder.Property(x => x.ParseError).HasMaxLength(1024);

        builder.HasIndex(x => x.ReceivedAtUtc);

        builder.HasOne(x => x.Device)
            .WithMany()
            .HasForeignKey(x => x.DeviceId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

