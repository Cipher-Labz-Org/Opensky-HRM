using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OnboardingController : ControllerBase
{
    private readonly IOnboardingService _onboardingService;
    public OnboardingController(IOnboardingService onboardingService) { _onboardingService = onboardingService; }

    [HttpGet("{employeeId:guid}/tasks")]
    public async Task<IActionResult> GetTasks(Guid employeeId)
        => Ok(await _onboardingService.GetTasksByEmployeeAsync(employeeId));

    [HttpPost("tasks/{taskId:guid}/complete")]
    public async Task<IActionResult> CompleteTask(Guid taskId)
    {
        var result = await _onboardingService.CompleteTaskAsync(taskId);
        return result is null ? NotFound() : Ok(result);
    }
}
