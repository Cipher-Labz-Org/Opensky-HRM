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

    public AuthController(IAuthService authService)
    {
        _authService = authService;
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
    public IActionResult GetAvailableModules()
    {
        var modules = new[] {
            new { module = "Dashboard", label = "Dashboard" },
            new { module = "People", label = "People Hub" },
            new { module = "Leave", label = "Leave & Absence" },
            new { module = "Attendance", label = "Time & Attendance" },
            new { module = "Payroll", label = "Payroll" },
            new { module = "Performance", label = "Performance" },
            new { module = "Learning", label = "Learning & Skills" },
            new { module = "OrgStructure", label = "Org Structure" },
            new { module = "Analytics", label = "Analytics" },
            new { module = "Settings", label = "Policy & Settings" },
            new { module = "Administration", label = "Administration" },
        };
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
