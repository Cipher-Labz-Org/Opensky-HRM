using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class InstanceModuleEntitlementConfiguration : IEntityTypeConfiguration<InstanceModuleEntitlement>
{
    public void Configure(EntityTypeBuilder<InstanceModuleEntitlement> builder)
    {
        builder.ToTable("InstanceModuleEntitlements");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => new { e.InstanceSubscriptionId, e.LicensedModuleId }).IsUnique();
        builder.HasOne(e => e.InstanceSubscription)
            .WithMany(s => s.ModuleEntitlements)
            .HasForeignKey(e => e.InstanceSubscriptionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(e => e.LicensedModule)
            .WithMany(m => m.Entitlements)
            .HasForeignKey(e => e.LicensedModuleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
