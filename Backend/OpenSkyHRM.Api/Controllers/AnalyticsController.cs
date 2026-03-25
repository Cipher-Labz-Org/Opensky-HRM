using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Analytics")]
[Route("api/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;
    public AnalyticsController(IAnalyticsService analyticsService) { _analyticsService = analyticsService; }

    [HttpGet("headcount")]
    public async Task<IActionResult> GetHeadcount(CancellationToken cancellationToken)
        => Ok(await _analyticsService.GetHeadcountAnalyticsAsync(cancellationToken));

    [HttpGet("reports")]
    public async Task<IActionResult> GetReports(CancellationToken cancellationToken)
        => Ok(await _analyticsService.GetReportsAsync(cancellationToken));

    /// <summary>Last stored snapshot from nightly Hangfire job; 404 if never run.</summary>
    [HttpGet("executive-dashboard/snapshot")]
    public async Task<IActionResult> GetExecutiveDashboardSnapshot(CancellationToken cancellationToken)
    {
        var cached = await _analyticsService.GetCachedExecutiveDashboardAsync(cancellationToken);
        if (cached is null)
            return NotFound(new { message = "No analytics snapshot yet. It is populated by the nightly job after deploy." });
        return Ok(cached);
    }

    /// <summary>Live-computed cross-module executive KPIs (may hit DB harder than snapshot).</summary>
    [HttpGet("executive-dashboard")]
    public async Task<IActionResult> GetExecutiveDashboard(CancellationToken cancellationToken)
        => Ok(await _analyticsService.GetExecutiveDashboardAsync(cancellationToken));
}
