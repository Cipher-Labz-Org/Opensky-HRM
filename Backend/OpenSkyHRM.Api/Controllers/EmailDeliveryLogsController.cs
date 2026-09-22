using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;

namespace OpenSkyHRM.Api.Controllers;

/// <summary>
/// Dedicated route for outbound email audit rows (avoids ambiguity with other api/settings patterns).
/// </summary>
[Authorize]
[ApiController]
[RequireLicensedModule("EmailDeliveryLog")]
[Route("api/email-delivery-logs")]
public class EmailDeliveryLogsController : ControllerBase
{
    private readonly ISettingsService _settingsService;

    public EmailDeliveryLogsController(ISettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null)
        => Ok(await _settingsService.GetOutboundEmailLogsAsync(page, pageSize, status));
}
