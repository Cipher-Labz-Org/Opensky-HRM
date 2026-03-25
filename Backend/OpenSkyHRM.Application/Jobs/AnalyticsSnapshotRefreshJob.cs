using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

/// <summary>Nightly persistence of executive dashboard JSON for optional fast reads.</summary>
public class AnalyticsSnapshotRefreshJob
{
    private readonly IAnalyticsService _analytics;
    private readonly ILogger<AnalyticsSnapshotRefreshJob> _logger;

    public AnalyticsSnapshotRefreshJob(IAnalyticsService analytics, ILogger<AnalyticsSnapshotRefreshJob> logger)
    {
        _analytics = analytics;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        await _analytics.RefreshExecutiveDashboardSnapshotAsync(cancellationToken);
        _logger.LogInformation("Executive dashboard analytics snapshot refreshed at {Time:u}", DateTime.UtcNow);
    }
}
