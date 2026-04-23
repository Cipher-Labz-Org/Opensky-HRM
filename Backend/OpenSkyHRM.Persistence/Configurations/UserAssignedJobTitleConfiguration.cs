using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserAssignedJobTitleConfiguration : IEntityTypeConfiguration<UserAssignedJobTitle>
{
    public void Configure(EntityTypeBuilder<UserAssignedJobTitle> builder)
    {
        builder.ToTable("UserAssignedJobTitles");
        builder.HasKey(x => x.Id);
        builder.HasIndex(x => new { x.UserId, x.JobTitleId }).IsUnique();

        builder.HasOne(x => x.User)
            .WithMany(u => u.AssignedJobTitles)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.JobTitle)
            .WithMany()
            .HasForeignKey(x => x.JobTitleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
