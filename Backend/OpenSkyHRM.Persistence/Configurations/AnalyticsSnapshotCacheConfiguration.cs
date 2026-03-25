using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Configurations;

public class AnalyticsSnapshotCacheConfiguration : IEntityTypeConfiguration<AnalyticsSnapshotCache>
{
    public void Configure(EntityTypeBuilder<AnalyticsSnapshotCache> builder)
    {
        builder.ToTable("AnalyticsSnapshotCaches");
        builder.Property(x => x.CacheKey).HasMaxLength(128).IsRequired();
        builder.HasIndex(x => x.CacheKey).IsUnique();
        builder.Property(x => x.PayloadJson).IsRequired();
    }
}
