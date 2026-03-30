using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class InstanceSubscriptionConfiguration : IEntityTypeConfiguration<InstanceSubscription>
{
    public void Configure(EntityTypeBuilder<InstanceSubscription> builder)
    {
        builder.ToTable("InstanceSubscriptions");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.InstanceKey).HasMaxLength(64).IsRequired();
        builder.HasIndex(e => e.InstanceKey).IsUnique();
        builder.Property(e => e.PlanName).HasMaxLength(200).IsRequired();
        builder.Property(e => e.Notes).HasMaxLength(2000);
    }
}
