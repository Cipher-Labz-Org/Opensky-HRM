using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class JobTitleConfiguration : IEntityTypeConfiguration<JobTitle>
{
    public void Configure(EntityTypeBuilder<JobTitle> builder)
    {
        builder.ToTable("JobTitles");
        builder.HasKey(j => j.Id);
        builder.HasIndex(j => j.Code).IsUnique();

        builder.Property(j => j.Title).HasMaxLength(150).IsRequired();
        builder.Property(j => j.Code).HasMaxLength(20).IsRequired();
        builder.Property(j => j.Description).HasMaxLength(500);
    }
}
