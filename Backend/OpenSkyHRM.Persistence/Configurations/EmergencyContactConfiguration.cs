using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmergencyContactConfiguration : IEntityTypeConfiguration<EmergencyContact>
{
    public void Configure(EntityTypeBuilder<EmergencyContact> builder)
    {
        builder.ToTable("EmergencyContacts");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Name).HasMaxLength(200).IsRequired();
        builder.Property(e => e.Relationship).HasMaxLength(100).IsRequired();
        builder.Property(e => e.HomeTelephone).HasMaxLength(30);
        builder.Property(e => e.MobileTelephone).HasMaxLength(30);
        builder.Property(e => e.WorkTelephone).HasMaxLength(30);

        builder.HasOne(e => e.Employee)
            .WithMany(emp => emp.EmergencyContacts)
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
