using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly ISettingsService _settingsService;
    public SettingsController(ISettingsService settingsService) { _settingsService = settingsService; }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
        => Ok(await _settingsService.GetRolesAsync());

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => Ok(await _settingsService.GetAuditLogsAsync(page, pageSize));

    [HttpGet("workflows")]
    public async Task<IActionResult> GetWorkflows()
        => Ok(await _settingsService.GetWorkflowsAsync());
}
