using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LeaveMonthlyAccrualConfiguration : IEntityTypeConfiguration<LeaveMonthlyAccrual>
{
    public void Configure(EntityTypeBuilder<LeaveMonthlyAccrual> builder)
    {
        builder.ToTable("LeaveMonthlyAccruals");

        builder.HasKey(x => x.Id);

        builder.HasIndex(x => new { x.EmployeeId, x.LeaveTypeId, x.Year, x.Month })
            .IsUnique();

        builder.HasOne(x => x.Employee)
            .WithMany()
            .HasForeignKey(x => x.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.LeaveType)
            .WithMany()
            .HasForeignKey(x => x.LeaveTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
