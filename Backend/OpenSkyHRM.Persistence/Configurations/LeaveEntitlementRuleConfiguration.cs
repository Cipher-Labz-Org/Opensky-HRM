using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LeaveEntitlementRuleConfiguration : IEntityTypeConfiguration<LeaveEntitlementRule>
{
    public void Configure(EntityTypeBuilder<LeaveEntitlementRule> builder)
    {
        builder.ToTable("LeaveEntitlementRules");
        builder.HasKey(r => r.Id);
        builder.Property(r => r.RuleType).HasMaxLength(50).IsRequired();
        builder.Property(r => r.RuleConfig).IsRequired();
        builder.HasOne(r => r.LeaveType).WithMany().HasForeignKey(r => r.LeaveTypeId);
    }
}
