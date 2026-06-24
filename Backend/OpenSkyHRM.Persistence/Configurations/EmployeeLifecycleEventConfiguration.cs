using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeLifecycleEventConfiguration : IEntityTypeConfiguration<EmployeeLifecycleEvent>
{
    public void Configure(EntityTypeBuilder<EmployeeLifecycleEvent> b)
    {
        b.ToTable("EmployeeLifecycleEvents");
        b.HasKey(x => x.Id);
        b.Property(x => x.EventType).HasMaxLength(64).IsRequired();
        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(2000);
        b.Property(x => x.DetailsJson).HasMaxLength(8000);
        b.Property(x => x.Source).HasMaxLength(32).IsRequired();
        b.Property(x => x.ExternalKey).HasMaxLength(128);
        b.HasIndex(x => x.EmployeeId);
        b.HasIndex(x => new { x.EmployeeId, x.EventDate });
        b.HasIndex(x => x.ExternalKey).IsUnique().HasFilter("\"ExternalKey\" IS NOT NULL");
        b.HasOne(x => x.Employee).WithMany().HasForeignKey(x => x.EmployeeId).OnDelete(DeleteBehavior.Cascade);
    }
}
