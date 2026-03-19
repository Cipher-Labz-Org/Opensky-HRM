using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeAttachmentConfiguration : IEntityTypeConfiguration<EmployeeAttachment>
{
    public void Configure(EntityTypeBuilder<EmployeeAttachment> builder)
    {
        builder.ToTable("EmployeeAttachments");
        builder.HasKey(a => a.Id);

        builder.Property(a => a.FileName).HasMaxLength(255).IsRequired();
        builder.Property(a => a.StoredFileName).HasMaxLength(500).IsRequired();
        builder.Property(a => a.Description).HasMaxLength(500);
        builder.Property(a => a.ContentType).HasMaxLength(100).IsRequired();
        builder.Property(a => a.AddedBy).HasMaxLength(200);

        builder.HasOne(a => a.Employee)
            .WithMany(e => e.Attachments)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(a => !a.IsDeleted);
    }
}
