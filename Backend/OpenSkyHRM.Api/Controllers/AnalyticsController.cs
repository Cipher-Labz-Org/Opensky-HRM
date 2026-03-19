using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;
    public AnalyticsController(IAnalyticsService analyticsService) { _analyticsService = analyticsService; }

    [HttpGet("headcount")]
    public async Task<IActionResult> GetHeadcount()
        => Ok(await _analyticsService.GetHeadcountAnalyticsAsync());

    [HttpGet("reports")]
    public async Task<IActionResult> GetReports()
        => Ok(await _analyticsService.GetReportsAsync());
}
