using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserAssignedGradeConfiguration : IEntityTypeConfiguration<UserAssignedGrade>
{
    public void Configure(EntityTypeBuilder<UserAssignedGrade> builder)
    {
        builder.ToTable("UserAssignedGrades");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.GradeId }).IsUnique();

        builder.HasOne(x => x.User)
            .WithMany(u => u.AssignedGrades)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Grade)
            .WithMany()
            .HasForeignKey(x => x.GradeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
