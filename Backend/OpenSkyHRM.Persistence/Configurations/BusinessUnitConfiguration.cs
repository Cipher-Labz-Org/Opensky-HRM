using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class BusinessUnitConfiguration : IEntityTypeConfiguration<BusinessUnit>
{
    public void Configure(EntityTypeBuilder<BusinessUnit> builder)
    {
        builder.ToTable("BusinessUnits");
        builder.HasKey(b => b.Id);
        builder.HasIndex(b => b.Code).IsUnique();

        builder.Property(b => b.Name).HasMaxLength(150).IsRequired();
        builder.Property(b => b.Code).HasMaxLength(20).IsRequired();
        builder.Property(b => b.Description).HasMaxLength(500);
    }
}
