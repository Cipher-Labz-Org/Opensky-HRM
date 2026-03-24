using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Auth;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILicensingService _licensing;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        ILicensingService licensing,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _licensing = licensing;
        _logger = logger;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        try
        {
            var result = await _authService.LoginAsync(dto);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed unexpectedly.");
            return StatusCode(500, new { message = "Sign-in failed. Check API logs or database connectivity." });
        }
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            var profile = await _authService.GetProfileAsync(userId.Value);
            return Ok(profile);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();

        try
        {
            await _authService.ChangePasswordAsync(userId.Value, dto);
            return Ok(new { message = "Password changed successfully." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("roles")]
    [Authorize]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _authService.GetRolesAsync();
        return Ok(roles);
    }

    [HttpGet("roles/available-modules")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetAvailableModules(CancellationToken cancellationToken)
    {
        var modules = await _licensing.GetLicensedModulesForRoleAssignmentAsync(cancellationToken);
        return Ok(modules);
    }

    [HttpPut("roles/{id:guid}/permissions")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateRolePermissions(Guid id, [FromBody] UpdateRolePermissionsDto dto)
    {
        var role = await _authService.UpdateRolePermissionsAsync(id, dto);
        return role is null ? NotFound() : Ok(role);
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
