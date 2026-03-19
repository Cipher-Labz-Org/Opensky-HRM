using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeSkillConfiguration : IEntityTypeConfiguration<EmployeeSkill>
{
    public void Configure(EntityTypeBuilder<EmployeeSkill> builder)
    {
        builder.ToTable("EmployeeSkills");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Skill).HasMaxLength(200).IsRequired();
        builder.Property(s => s.YearsOfExperience).HasMaxLength(20);
        builder.Property(s => s.Comments).HasMaxLength(1000);

        builder.HasOne(s => s.Employee)
            .WithMany(e => e.Skills)
            .HasForeignKey(s => s.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}
