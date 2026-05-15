using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class SalaryAdvanceRequestConfiguration : IEntityTypeConfiguration<SalaryAdvanceRequest>
{
    public void Configure(EntityTypeBuilder<SalaryAdvanceRequest> builder)
    {
        builder.ToTable("SalaryAdvanceRequests");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(x => x.Currency).HasMaxLength(10);
        builder.Property(x => x.Amount).HasColumnType("numeric(18,2)");
        builder.Property(x => x.Remarks).HasMaxLength(2000);
        builder.Property(x => x.ReviewedBy).HasMaxLength(200);
        builder.Property(x => x.RejectionReason).HasMaxLength(2000);

        builder.HasIndex(x => new { x.EmployeeId, x.PayrollBatchId, x.Status });

        builder.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.PayrollBatch)
            .WithMany()
            .HasForeignKey(x => x.PayrollBatchId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
