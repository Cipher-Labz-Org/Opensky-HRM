using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>Nightly (or manual) JSON snapshot of heavy analytics for fast reads.</summary>
public class AnalyticsSnapshotCache : BaseEntity
{
    public const string ExecutiveDashboardKey = "executive_dashboard";

    /// <summary>Stable key, e.g. ExecutiveDashboardKey.</summary>
    public string CacheKey { get; set; } = string.Empty;

    public string PayloadJson { get; set; } = string.Empty;

    public DateTime CapturedAtUtc { get; set; }
}
