using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EducationConfiguration : IEntityTypeConfiguration<Education>
{
    public void Configure(EntityTypeBuilder<Education> builder)
    {
        builder.ToTable("Educations");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Level).HasMaxLength(100).IsRequired();
        builder.Property(e => e.Institute).HasMaxLength(255);
        builder.Property(e => e.Major).HasMaxLength(255);
        builder.Property(e => e.Year).HasMaxLength(10);
        builder.Property(e => e.GpaScore).HasMaxLength(20);

        builder.HasOne(e => e.Employee)
            .WithMany(emp => emp.Educations)
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}
