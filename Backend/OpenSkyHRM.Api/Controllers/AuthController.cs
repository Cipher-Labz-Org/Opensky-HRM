using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;
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
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public AuthController(
        IAuthService authService,
        ILicensingService licensing,
        ILogger<AuthController> logger,
        IWebHostEnvironment env,
        IConfiguration config)
    {
        _authService = authService;
        _licensing = licensing;
        _logger = logger;
        _env = env;
        _config = config;
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

    public record BootstrapAdminRequest(string ConfirmPhrase, string? Password);

    /// <summary>
    /// Dev-only safety valve: recreate a usable admin account if the database was reset and no admins remain.
    /// Guarded by a confirmation phrase and localhost-only usage.
    /// </summary>
    [HttpPost("bootstrap-admin")]
    [AllowAnonymous]
    public async Task<IActionResult> BootstrapAdmin(
        [FromBody] BootstrapAdminRequest body,
        [FromServices] AppDbContext db,
        CancellationToken cancellationToken)
    {
        if (!_env.IsDevelopment())
            return NotFound();

        var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "";
        if (remoteIp != "127.0.0.1" && remoteIp != "::1" && remoteIp != "localhost")
            return Forbid();

        var requiredPhrase = _config["CustomerReset:ConfirmPhrase"];
        if (string.IsNullOrWhiteSpace(requiredPhrase))
            requiredPhrase = "ERASE CUSTOMER DATA";

        if (!string.Equals((body.ConfirmPhrase ?? "").Trim(), requiredPhrase.Trim(), StringComparison.Ordinal))
            return Unauthorized(new { message = "Invalid confirmation phrase." });

        var password = string.IsNullOrWhiteSpace(body.Password)
            ? (_config["CustomerReset:BootstrapAdminPassword"] ?? "Admin@123")
            : body.Password!;

        await AdminBootstrapSeeder.EnsureAsync(
            db,
            adminPassword: password,
            forceResetPassword: true,
            cancellationToken: cancellationToken);
        return Ok(new { message = "Admin bootstrap ensured.", username = "admin" });
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
