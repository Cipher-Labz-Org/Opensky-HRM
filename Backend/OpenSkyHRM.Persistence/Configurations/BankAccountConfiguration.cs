using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class BankAccountConfiguration : IEntityTypeConfiguration<BankAccount>
{
    public void Configure(EntityTypeBuilder<BankAccount> builder)
    {
        builder.ToTable("BankAccounts");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Amount).HasPrecision(18, 2).IsRequired();
        builder.Property(b => b.AccountNumber).HasMaxLength(50).IsRequired();
        builder.Property(b => b.BankName).HasMaxLength(200);
        builder.Property(b => b.AccountType).HasMaxLength(30).IsRequired();
        builder.Property(b => b.BankCode).HasMaxLength(20);
        builder.Property(b => b.BranchCode).HasMaxLength(20);
        builder.Property(b => b.BranchLocation).HasMaxLength(200);

        builder.HasOne(b => b.Employee)
            .WithMany(e => e.BankAccounts)
            .HasForeignKey(b => b.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}
