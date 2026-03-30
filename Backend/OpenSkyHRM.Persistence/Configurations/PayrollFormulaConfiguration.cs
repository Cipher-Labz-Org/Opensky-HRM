using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PayrollFormulaConfiguration : IEntityTypeConfiguration<PayrollFormula>
{
    public void Configure(EntityTypeBuilder<PayrollFormula> builder)
    {
        builder.ToTable("PayrollFormulas");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Name).HasMaxLength(200).IsRequired();
        builder.Property(f => f.Expression).HasMaxLength(500).IsRequired();

        builder.HasOne(f => f.Component)
            .WithMany(c => c.Formulas)
            .HasForeignKey(f => f.ComponentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
