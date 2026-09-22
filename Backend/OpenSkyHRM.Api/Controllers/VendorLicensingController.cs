using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Licensing;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/vendor-licensing")]
public class VendorLicensingController : ControllerBase
{
    private readonly IVendorLicensingAuthService _auth;
    private readonly ILicensingService _licensing;

    public VendorLicensingController(IVendorLicensingAuthService auth, ILicensingService licensing)
    {
        _auth = auth;
        _licensing = licensing;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<VendorLicensingLoginResponseDto>> Login(
        [FromBody] VendorLicensingLoginDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            var clientKey = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _auth.LoginAsync(dto, clientKey, cancellationToken);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpGet("state")]
    [Authorize(Policy = "VendorLicensing")]
    public async Task<ActionResult<LicensingAdminDto>> GetState(CancellationToken cancellationToken)
        => Ok(await _licensing.GetAdminStateAsync(cancellationToken));

    [HttpPut("entitlements")]
    [Authorize(Policy = "VendorLicensing")]
    public async Task<IActionResult> UpdateEntitlements(
        [FromBody] UpdateModuleEntitlementsDto dto,
        CancellationToken cancellationToken)
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
    public async Task<ActionResult<InstanceSubscriptionDto>> UpdateSubscription(
        [FromBody] UpdateInstanceSubscriptionDto dto,
        CancellationToken cancellationToken)
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
