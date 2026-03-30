using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class WorkExperienceConfiguration : IEntityTypeConfiguration<WorkExperience>
{
    public void Configure(EntityTypeBuilder<WorkExperience> builder)
    {
        builder.ToTable("WorkExperiences");
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Company).HasMaxLength(200).IsRequired();
        builder.Property(w => w.JobTitle).HasMaxLength(200).IsRequired();
        builder.Property(w => w.EmploymentType).HasMaxLength(80);
        builder.Property(w => w.Comment).HasMaxLength(1000);

        builder.HasOne(w => w.Employee)
            .WithMany(e => e.WorkExperiences)
            .HasForeignKey(w => w.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(w => !w.IsDeleted);
    }
}
