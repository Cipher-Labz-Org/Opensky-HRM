using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class TrainingAssignmentConfiguration : IEntityTypeConfiguration<TrainingAssignment>
{
    public void Configure(EntityTypeBuilder<TrainingAssignment> entity)
    {
        entity.ToTable("TrainingAssignments");
        entity.HasIndex(e => new { e.EmployeeId, e.CourseId, e.Status });
        entity.HasIndex(e => e.DueDate);

        entity.HasOne(e => e.Employee)
            .WithMany()
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(e => e.Course)
            .WithMany()
            .HasForeignKey(e => e.CourseId)
            .OnDelete(DeleteBehavior.Restrict);

        entity.HasOne(e => e.AssignedBy)
            .WithMany()
            .HasForeignKey(e => e.AssignedByEmployeeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
