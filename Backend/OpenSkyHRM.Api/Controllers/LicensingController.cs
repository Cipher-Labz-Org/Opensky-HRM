using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LicensingController : ControllerBase
{
    private readonly ILicensingService _licensing;

    public LicensingController(ILicensingService licensing)
    {
        _licensing = licensing;
    }

    [HttpGet("effective-modules")]
    [Authorize]
    public async Task<ActionResult<EffectiveModulesDto>> GetEffectiveModules(CancellationToken cancellationToken)
    {
        var modules = await _licensing.GetEffectiveModuleCodesAsync(cancellationToken);
        return Ok(new EffectiveModulesDto { Modules = modules.ToList() });
    }

    [HttpGet("summary")]
    [Authorize]
    public async Task<ActionResult<LicensingSummaryDto>> GetSummary(CancellationToken cancellationToken)
    {
        return Ok(await _licensing.GetSummaryAsync(cancellationToken));
    }

    [HttpGet("admin")]
    [Authorize(Policy = "VendorLicensing")]
    public async Task<ActionResult<LicensingAdminDto>> GetAdmin(CancellationToken cancellationToken)
    {
        return Ok(await _licensing.GetAdminStateAsync(cancellationToken));
    }

    [HttpPut("entitlements")]
    [Authorize(Policy = "VendorLicensing")]
    public async Task<IActionResult> UpdateEntitlements([FromBody] UpdateModuleEntitlementsDto dto, CancellationToken cancellationToken)
    {
        try
        {
            await _licensing.UpdateEntitlementsAsync(dto, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("subscription")]
    [Authorize(Policy = "VendorLicensing")]
    public async Task<ActionResult<InstanceSubscriptionDto>> UpdateSubscription([FromBody] UpdateInstanceSubscriptionDto dto, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _licensing.UpdateSubscriptionAsync(dto, cancellationToken);
            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
