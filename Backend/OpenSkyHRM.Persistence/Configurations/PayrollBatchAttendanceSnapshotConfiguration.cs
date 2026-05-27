using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class PayrollBatchAttendanceSnapshotConfiguration : IEntityTypeConfiguration<PayrollBatchAttendanceSnapshot>
{
    public void Configure(EntityTypeBuilder<PayrollBatchAttendanceSnapshot> builder)
    {
        builder.ToTable("PayrollBatchAttendanceSnapshots");
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => new { s.BatchId, s.EmployeeId }).IsUnique();

        builder.Property(s => s.ApprovedOtHours).HasColumnType("numeric(18,2)");
        builder.Property(s => s.OtAmount).HasColumnType("numeric(18,2)");

        builder.HasOne(s => s.Batch)
            .WithMany()
            .HasForeignKey(s => s.BatchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Employee)
            .WithMany()
            .HasForeignKey(s => s.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
