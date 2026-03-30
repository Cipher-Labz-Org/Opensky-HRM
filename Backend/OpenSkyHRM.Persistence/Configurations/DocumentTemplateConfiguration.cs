using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class DocumentTemplateConfiguration : IEntityTypeConfiguration<DocumentTemplate>
{
    public void Configure(EntityTypeBuilder<DocumentTemplate> builder)
    {
        builder.ToTable("DocumentTemplates");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Name).HasMaxLength(200).IsRequired();
        builder.Property(d => d.TemplateKey).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Subject).HasMaxLength(500);
        builder.Property(d => d.HtmlContent).IsRequired();

        builder.HasIndex(d => d.TemplateKey).IsUnique();
        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
