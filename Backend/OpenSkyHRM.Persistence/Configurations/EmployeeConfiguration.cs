using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("Employees");
        builder.HasKey(e => e.Id);
        builder.HasIndex(e => e.EmployeeCode).IsUnique();
        builder.HasIndex(e => e.Email).IsUnique();

        builder.Property(e => e.EmployeeCode).HasMaxLength(20).IsRequired();
        builder.Property(e => e.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.LastName).HasMaxLength(100).IsRequired();
        builder.Property(e => e.Email).HasMaxLength(255).IsRequired();
        builder.Property(e => e.Phone).HasMaxLength(20);
        builder.Property(e => e.ProfileImageUrl).HasMaxLength(500);
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.Gender).HasConversion<string>().HasMaxLength(10);

        builder.Ignore(e => e.FullName);

        builder.HasOne(e => e.Department)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.BusinessUnit)
            .WithMany(b => b.Employees)
            .HasForeignKey(e => e.BusinessUnitId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Position)
            .WithMany(p => p.Employees)
            .HasForeignKey(e => e.PositionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Location)
            .WithMany(l => l.Employees)
            .HasForeignKey(e => e.LocationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Grade)
            .WithMany(g => g.Employees)
            .HasForeignKey(e => e.GradeId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.JobTitle)
            .WithMany(j => j.Employees)
            .HasForeignKey(e => e.JobTitleId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.Manager)
            .WithMany(e => e.DirectReports)
            .HasForeignKey(e => e.ManagerId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
