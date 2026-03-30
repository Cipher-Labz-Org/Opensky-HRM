using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeAttachmentTypeConfiguration : IEntityTypeConfiguration<EmployeeAttachmentType>
{
    public void Configure(EntityTypeBuilder<EmployeeAttachmentType> builder)
    {
        builder.ToTable("EmployeeAttachmentTypes");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(150).IsRequired();
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}
