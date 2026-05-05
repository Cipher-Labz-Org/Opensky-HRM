using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserAssignedLocationConfiguration : IEntityTypeConfiguration<UserAssignedLocation>
{
    public void Configure(EntityTypeBuilder<UserAssignedLocation> builder)
    {
        builder.ToTable("UserAssignedLocations");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.LocationId }).IsUnique();

        builder.HasOne(x => x.User)
            .WithMany(u => u.AssignedLocations)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Location)
            .WithMany(l => l.UserAssignments)
            .HasForeignKey(x => x.LocationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
