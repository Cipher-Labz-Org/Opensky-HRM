using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class RequisitionSkillTemplateConfiguration : IEntityTypeConfiguration<RequisitionSkillTemplate>
{
    public void Configure(EntityTypeBuilder<RequisitionSkillTemplate> builder)
    {
        builder.ToTable("RequisitionSkillTemplates");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).HasMaxLength(150).IsRequired();
        builder.Property(t => t.Keywords).HasMaxLength(500).IsRequired();
        builder.Property(t => t.Skills).HasMaxLength(2000).IsRequired();

        builder.HasIndex(t => t.IsActive);
        builder.HasIndex(t => t.SortOrder);

        builder.HasOne(t => t.JobTitle)
            .WithMany()
            .HasForeignKey(t => t.JobTitleId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
