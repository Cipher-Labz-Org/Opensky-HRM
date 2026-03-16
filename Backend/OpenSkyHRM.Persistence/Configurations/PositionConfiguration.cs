using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.ToTable("Positions");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => p.Code).IsUnique();

        builder.Property(p => p.Title).HasMaxLength(150).IsRequired();
        builder.Property(p => p.Code).HasMaxLength(20).IsRequired();

        builder.HasOne(p => p.Department)
            .WithMany(d => d.Positions)
            .HasForeignKey(p => p.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Location)
            .WithMany(l => l.Positions)
            .HasForeignKey(p => p.LocationId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(p => p.JobTitle)
            .WithMany(j => j.Positions)
            .HasForeignKey(p => p.JobTitleId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(p => p.ReportsToPosition)
            .WithMany()
            .HasForeignKey(p => p.ReportsToPositionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
