using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class EmployeeLanguageConfiguration : IEntityTypeConfiguration<EmployeeLanguage>
{
    public void Configure(EntityTypeBuilder<EmployeeLanguage> builder)
    {
        builder.ToTable("EmployeeLanguages");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Language).HasMaxLength(100).IsRequired();
        builder.Property(l => l.Skill).HasMaxLength(100).IsRequired();
        builder.Property(l => l.FluencyLevel).HasMaxLength(100).IsRequired();
        builder.Property(l => l.Comments).HasMaxLength(1000);

        builder.HasOne(l => l.Employee)
            .WithMany(e => e.Languages)
            .HasForeignKey(l => l.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(l => !l.IsDeleted);
    }
}
