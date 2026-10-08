using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> builder)
    {
        builder.Property(x => x.DurationKind).HasMaxLength(20).IsRequired();
        builder.Property(x => x.HalfDayPeriod).HasMaxLength(20);
        builder.Property(x => x.ShortLeaveStartTime).HasMaxLength(5);
        builder.Property(x => x.ShortLeaveEndTime).HasMaxLength(5);

        builder.HasOne(x => x.Level1Approver)
            .WithMany()
            .HasForeignKey(x => x.Level1ApproverId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(x => x.Level2Approver)
            .WithMany()
            .HasForeignKey(x => x.Level2ApproverId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
