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
        builder.HasOne(x => x.DefaultShiftPattern)
            .WithMany()
            .HasForeignKey(x => x.DefaultShiftPatternId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
