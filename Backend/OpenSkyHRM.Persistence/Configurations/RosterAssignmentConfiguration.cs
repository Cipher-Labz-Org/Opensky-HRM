using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class RosterAssignmentConfiguration : IEntityTypeConfiguration<RosterAssignment>
{
    public void Configure(EntityTypeBuilder<RosterAssignment> builder)
    {
        builder.ToTable("RosterAssignments");
        builder.HasKey(x => x.Id);
        builder.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(x => x.RosterTemplate)
            .WithMany()
            .HasForeignKey(x => x.RosterTemplateId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(x => new { x.EmployeeId, x.EffectiveFrom });
    }
}
