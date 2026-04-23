using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserAssignedBusinessUnitConfiguration : IEntityTypeConfiguration<UserAssignedBusinessUnit>
{
    public void Configure(EntityTypeBuilder<UserAssignedBusinessUnit> builder)
    {
        builder.ToTable("UserAssignedBusinessUnits");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.BusinessUnitId }).IsUnique();

        builder.HasOne(x => x.User)
            .WithMany(u => u.AssignedBusinessUnits)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.BusinessUnit)
            .WithMany()
            .HasForeignKey(x => x.BusinessUnitId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
