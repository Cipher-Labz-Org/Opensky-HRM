using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class CompensationComponentConfiguration : IEntityTypeConfiguration<CompensationComponent>
{
    public void Configure(EntityTypeBuilder<CompensationComponent> builder)
    {
        builder.ToTable("CompensationComponents");
        builder.HasKey(c => c.Id);
        builder.HasIndex(c => c.Code).IsUnique();

        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Code).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Type).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.Category).HasConversion<string>().HasMaxLength(30);
        builder.Property(c => c.Description).HasMaxLength(500);
        builder.Property(c => c.FormulaExpression).HasMaxLength(500);
        builder.Property(c => c.DependsOnComponentCode).HasMaxLength(50);
    }
}
