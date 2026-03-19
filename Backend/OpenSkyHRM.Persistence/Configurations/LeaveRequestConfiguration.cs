using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> builder)
    {
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
