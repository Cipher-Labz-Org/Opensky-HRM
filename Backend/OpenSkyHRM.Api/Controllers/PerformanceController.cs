using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PerformanceController : ControllerBase
{
    private readonly IPerformanceService _perfService;
    private readonly AppDbContext _db;

    public PerformanceController(IPerformanceService perfService, AppDbContext db)
    {
        _perfService = perfService;
        _db = db;
    }

    [HttpGet("goals")]
    public async Task<IActionResult> GetGoals([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? employeeId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _perfService.GetGoalsAsync(page, pageSize, employeeId, allowedIds));
    }

    [HttpGet("cycles")]
    public async Task<IActionResult> GetCycles()
        => Ok(await _perfService.GetReviewCyclesAsync());

    [HttpGet("reviews")]
    public async Task<IActionResult> GetReviews([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _perfService.GetReviewsAsync(page, pageSize, allowedIds));
    }
}
