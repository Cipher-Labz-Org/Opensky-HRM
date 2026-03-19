using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class OnboardingController : ControllerBase
{
    private readonly IOnboardingService _onboardingService;
    private readonly AppDbContext _db;

    public OnboardingController(IOnboardingService onboardingService, AppDbContext db)
    {
        _onboardingService = onboardingService;
        _db = db;
    }

    [HttpGet("{employeeId:guid}/tasks")]
    public async Task<IActionResult> GetTasks(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _onboardingService.GetTasksByEmployeeAsync(employeeId));
    }

    [HttpPost("tasks/{taskId:guid}/complete")]
    public async Task<IActionResult> CompleteTask(Guid taskId)
    {
        var task = await _db.OnboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, task.EmployeeId, "Update"))
            return Forbid();
        var result = await _onboardingService.CompleteTaskAsync(taskId);
        return result is null ? NotFound() : Ok(result);
    }
}
