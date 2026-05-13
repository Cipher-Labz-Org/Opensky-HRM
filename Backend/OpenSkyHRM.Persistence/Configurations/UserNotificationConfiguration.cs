using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class UserNotificationConfiguration : IEntityTypeConfiguration<UserNotification>
{
    public void Configure(EntityTypeBuilder<UserNotification> builder)
    {
        builder.ToTable("UserNotifications");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Body).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.Category).HasMaxLength(80).IsRequired();
        builder.Property(x => x.DedupeKey).HasMaxLength(256).IsRequired();

        builder.HasIndex(x => x.DedupeKey).IsUnique();
        builder.HasIndex(x => new { x.UserId, x.CreatedAt });

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.RelatedEmployeeAttachment)
            .WithMany()
            .HasForeignKey(x => x.RelatedEmployeeAttachmentId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
