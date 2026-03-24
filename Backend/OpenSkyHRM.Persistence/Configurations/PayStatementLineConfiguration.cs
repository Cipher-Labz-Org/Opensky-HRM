using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PayStatementLineConfiguration : IEntityTypeConfiguration<PayStatementLine>
{
    public void Configure(EntityTypeBuilder<PayStatementLine> builder)
    {
        builder.ToTable("PayStatementLines");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.ComponentName).HasMaxLength(200).IsRequired();
        builder.Property(l => l.ComponentCode).HasMaxLength(50).IsRequired();
        builder.Property(l => l.Type).HasMaxLength(30).IsRequired();
        builder.Property(l => l.Amount).HasColumnType("numeric(18,2)");

        builder.HasOne(l => l.PayStatement)
            .WithMany(p => p.Lines)
            .HasForeignKey(l => l.PayStatementId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(l => l.Component)
            .WithMany()
            .HasForeignKey(l => l.ComponentId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
