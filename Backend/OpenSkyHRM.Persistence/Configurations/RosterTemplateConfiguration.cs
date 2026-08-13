using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class RosterTemplateConfiguration : IEntityTypeConfiguration<RosterTemplate>
{
    public void Configure(EntityTypeBuilder<RosterTemplate> builder)
    {
        builder.ToTable("RosterTemplates");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(x => x.Code);
        builder.HasOne(x => x.DefaultShiftPattern)
            .WithMany()
            .HasForeignKey(x => x.DefaultShiftPatternId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
