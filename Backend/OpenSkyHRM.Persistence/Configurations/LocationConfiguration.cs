using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LocationConfiguration : IEntityTypeConfiguration<Location>
{
    public void Configure(EntityTypeBuilder<Location> builder)
    {
        builder.ToTable("Locations");
        builder.HasKey(l => l.Id);
        builder.HasIndex(l => l.Code).IsUnique();

        builder.Property(l => l.Name).HasMaxLength(150).IsRequired();
        builder.Property(l => l.Code).HasMaxLength(20).IsRequired();
        builder.Property(l => l.Address).HasMaxLength(500);
        builder.Property(l => l.City).HasMaxLength(100);
        builder.Property(l => l.Country).HasMaxLength(100);
    }
}
