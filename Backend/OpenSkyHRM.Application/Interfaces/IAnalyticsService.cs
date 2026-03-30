using OpenSkyHRM.Application.DTOs.Analytics;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAnalyticsService
{
    Task<HeadcountAnalyticsDto> GetHeadcountAnalyticsAsync(CancellationToken cancellationToken = default);

    Task<List<ReportDefinitionDto>> GetReportsAsync(CancellationToken cancellationToken = default);

    Task<ExecutiveDashboardDto> GetExecutiveDashboardAsync(CancellationToken cancellationToken = default);

    /// <summary>Last nightly JSON snapshot; null if never captured.</summary>
    Task<ExecutiveDashboardDto?> GetCachedExecutiveDashboardAsync(CancellationToken cancellationToken = default);

    /// <summary>Persists executive dashboard JSON for fast reads (Hangfire).</summary>
    Task RefreshExecutiveDashboardSnapshotAsync(CancellationToken cancellationToken = default);
}
