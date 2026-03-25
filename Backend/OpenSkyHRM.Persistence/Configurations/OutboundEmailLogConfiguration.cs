using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class OutboundEmailLogConfiguration : IEntityTypeConfiguration<OutboundEmailLog>
{
    public void Configure(EntityTypeBuilder<OutboundEmailLog> b)
    {
        b.ToTable("OutboundEmailLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Category).HasMaxLength(64).IsRequired();
        b.Property(x => x.RecipientEmail).HasMaxLength(320).IsRequired();
        b.Property(x => x.RecipientName).HasMaxLength(200);
        b.Property(x => x.Subject).HasMaxLength(500).IsRequired();
        b.Property(x => x.Status).HasMaxLength(32).IsRequired();
        b.Property(x => x.Provider).HasMaxLength(32).IsRequired();
        b.Property(x => x.FromEmail).HasMaxLength(320);
        b.Property(x => x.ErrorDetail).HasMaxLength(4000);
        b.HasIndex(x => x.CreatedAt);
    }
}
