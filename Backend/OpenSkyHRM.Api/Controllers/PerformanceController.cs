using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PerformanceController : ControllerBase
{
    private readonly IPerformanceService _perfService;
    public PerformanceController(IPerformanceService perfService) { _perfService = perfService; }

    [HttpGet("goals")]
    public async Task<IActionResult> GetGoals([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? employeeId = null)
        => Ok(await _perfService.GetGoalsAsync(page, pageSize, employeeId));

    [HttpGet("cycles")]
    public async Task<IActionResult> GetCycles()
        => Ok(await _perfService.GetReviewCyclesAsync());

    [HttpGet("reviews")]
    public async Task<IActionResult> GetReviews([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _perfService.GetReviewsAsync(page, pageSize));
}
