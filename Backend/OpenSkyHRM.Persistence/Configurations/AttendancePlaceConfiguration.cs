using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Configurations;

public class AttendancePlaceConfiguration : IEntityTypeConfiguration<AttendancePlace>
{
    public void Configure(EntityTypeBuilder<AttendancePlace> builder)
    {
        builder.ToTable("AttendancePlaces");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.Code)
            .IsUnique()
            .HasFilter("NOT \"IsDeleted\"");

        builder.Property(p => p.Name).HasMaxLength(150).IsRequired();
        builder.Property(p => p.Code).HasMaxLength(20).IsRequired();
        builder.Property(p => p.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(p => p.GeofenceRadiusMeters).HasDefaultValue(20);
        builder.Property(p => p.Latitude).HasColumnType("numeric");
        builder.Property(p => p.Longitude).HasColumnType("numeric");

        builder.HasIndex(p => p.LocationId)
            .IsUnique()
            .HasFilter("\"LocationId\" IS NOT NULL AND NOT \"IsDeleted\"");

        builder.HasIndex(p => p.BusinessUnitId)
            .IsUnique()
            .HasFilter("\"BusinessUnitId\" IS NOT NULL AND NOT \"IsDeleted\"");

        builder.HasOne(p => p.Location)
            .WithMany(l => l.AttendancePlaces)
            .HasForeignKey(p => p.LocationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.BusinessUnit)
            .WithMany(b => b.AttendancePlaces)
            .HasForeignKey(p => p.BusinessUnitId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
