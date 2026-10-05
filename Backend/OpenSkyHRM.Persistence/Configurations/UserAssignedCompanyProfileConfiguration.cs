using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserAssignedCompanyProfileConfiguration : IEntityTypeConfiguration<UserAssignedCompanyProfile>
{
    public void Configure(EntityTypeBuilder<UserAssignedCompanyProfile> builder)
    {
        builder.ToTable("UserAssignedCompanyProfiles");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.CompanyProfileKey).HasMaxLength(64).IsRequired();
        builder.HasIndex(x => new { x.UserId, x.CompanyProfileKey }).IsUnique();

        builder.HasOne(x => x.User)
            .WithMany(u => u.AssignedCompanyProfiles)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
