using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LicensedModuleConfiguration : IEntityTypeConfiguration<LicensedModule>
{
    public void Configure(EntityTypeBuilder<LicensedModule> builder)
    {
        builder.ToTable("LicensedModules");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Code).HasMaxLength(80).IsRequired();
        builder.HasIndex(e => e.Code).IsUnique();
        builder.Property(e => e.DisplayName).HasMaxLength(200).IsRequired();
        builder.Property(e => e.Category).HasMaxLength(80).IsRequired();
    }
}
