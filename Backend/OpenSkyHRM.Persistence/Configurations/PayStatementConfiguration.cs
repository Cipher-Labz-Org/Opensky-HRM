using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PayStatementConfiguration : IEntityTypeConfiguration<PayStatement>
{
    public void Configure(EntityTypeBuilder<PayStatement> builder)
    {
        builder.ToTable("PayStatements");
        builder.HasKey(p => p.Id);
        builder.HasIndex(p => new { p.EmployeeId, p.Year, p.Month });

        builder.Property(p => p.BasicPay).HasColumnType("numeric(18,2)");
        builder.Property(p => p.TotalEarnings).HasColumnType("numeric(18,2)");
        builder.Property(p => p.TotalDeductions).HasColumnType("numeric(18,2)");
        builder.Property(p => p.GrossPay).HasColumnType("numeric(18,2)");
        builder.Property(p => p.NetPay).HasColumnType("numeric(18,2)");
        builder.Property(p => p.EmployerCost).HasColumnType("numeric(18,2)");
        builder.Property(p => p.Currency).HasMaxLength(10).HasDefaultValue("LKR");
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);

        builder.HasOne(p => p.Batch)
            .WithMany(b => b.PayStatements)
            .HasForeignKey(p => p.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.Employee)
            .WithMany()
            .HasForeignKey(p => p.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
