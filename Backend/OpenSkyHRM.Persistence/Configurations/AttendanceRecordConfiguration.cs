using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
{
    public void Configure(EntityTypeBuilder<AttendanceRecord> builder)
    {
        builder.HasOne(a => a.AttendancePlace)
            .WithMany(p => p.AttendanceRecords)
            .HasForeignKey(a => a.AttendancePlaceId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
