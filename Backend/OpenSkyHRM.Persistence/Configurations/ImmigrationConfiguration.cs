using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class ImmigrationConfiguration : IEntityTypeConfiguration<Immigration>
{
    public void Configure(EntityTypeBuilder<Immigration> builder)
    {
        builder.ToTable("Immigrations");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.DocumentType).HasMaxLength(50).IsRequired();
        builder.Property(i => i.Number).HasMaxLength(100).IsRequired();
        builder.Property(i => i.IssuedBy).HasMaxLength(100);
        builder.Property(i => i.EligibleStatus).HasMaxLength(200);
        builder.Property(i => i.Comments).HasMaxLength(1000);

        builder.HasOne(i => i.Employee)
            .WithMany(e => e.Immigrations)
            .HasForeignKey(i => i.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(i => !i.IsDeleted);
    }
}
