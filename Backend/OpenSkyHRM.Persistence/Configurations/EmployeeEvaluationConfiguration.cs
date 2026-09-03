using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeEvaluationConfiguration : IEntityTypeConfiguration<EmployeeEvaluation>
{
    public void Configure(EntityTypeBuilder<EmployeeEvaluation> b)
    {
        b.ToTable("EmployeeEvaluations");
        b.Property(x => x.Rating).IsRequired();
        b.Property(x => x.Comment).HasMaxLength(2000);
        b.Property(x => x.EvaluatorName).HasMaxLength(200);
        b.HasIndex(x => x.EmployeeId);
        b.HasIndex(x => x.CreatedAt);

        b.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.EvaluatorEmployee)
            .WithMany()
            .HasForeignKey(x => x.EvaluatorEmployeeId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
