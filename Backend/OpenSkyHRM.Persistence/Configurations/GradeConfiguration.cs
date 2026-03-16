using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class GradeConfiguration : IEntityTypeConfiguration<Grade>
{
    public void Configure(EntityTypeBuilder<Grade> builder)
    {
        builder.ToTable("Grades");
        builder.HasKey(g => g.Id);
        builder.HasIndex(g => g.Code).IsUnique();

        builder.Property(g => g.Name).HasMaxLength(100).IsRequired();
        builder.Property(g => g.Code).HasMaxLength(20).IsRequired();
        builder.Property(g => g.Description).HasMaxLength(500);
    }
}
