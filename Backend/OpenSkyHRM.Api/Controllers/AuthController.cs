using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;
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
    private readonly ISystemSettingService _systemSettings;
    private readonly ILogger<AuthController> _logger;
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _config;

    public AuthController(
        IAuthService authService,
        ILicensingService licensing,
        ISystemSettingService systemSettings,
        ILogger<AuthController> logger,
        IWebHostEnvironment env,
        IConfiguration config)
    {
        _authService = authService;
        _licensing = licensing;
        _systemSettings = systemSettings;
        _logger = logger;
        _env = env;
        _config = config;
    }

    /// <summary>Public branding for the sign-in page (company name + logo path).</summary>
    [HttpGet("branding")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBranding()
    {
        try
        {
            var settings = await _systemSettings.GetAllAsync();
            static string S(IReadOnlyDictionary<string, string> map, string key) =>
                map.TryGetValue(key, out var v) ? v : "";
            var companyName = S(settings, "CompanyName").Trim();
            var logo = S(settings, "CompanyLogoUrl").Trim();
            var scaleRaw = S(settings, "CompanyLogoLoginScale").Trim();
            var offsetXRaw = S(settings, "CompanyLogoLoginOffsetX").Trim();
            var offsetYRaw = S(settings, "CompanyLogoLoginOffsetY").Trim();
            var fitRaw = S(settings, "CompanyLogoLoginFit").Trim().ToLowerInvariant();
            _ = int.TryParse(scaleRaw, out var scale);
            _ = int.TryParse(offsetXRaw, out var offsetX);
            _ = int.TryParse(offsetYRaw, out var offsetY);
            if (scale < 20 || scale > 500) scale = 100;
            if (offsetX < -80 || offsetX > 80) offsetX = 0;
            if (offsetY < -80 || offsetY > 80) offsetY = 0;
            var fit = fitRaw == "cover" ? "cover" : "contain";
            return Ok(new
            {
                companyName = string.IsNullOrEmpty(companyName) ? "OpenSky HRM" : companyName,
                companyLogoUrl = string.IsNullOrEmpty(logo) ? null : logo,
                loginLogoScale = scale,
                loginLogoOffsetX = offsetX,
                loginLogoOffsetY = offsetY,
                loginLogoFit = fit,
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load login branding; returning defaults.");
            return Ok(new { companyName = "OpenSky HRM", companyLogoUrl = (string?)null });
        }
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
        catch (PostgresException pg) when (pg.SqlState is "42P01" or "42703")
        {
            _logger.LogError(pg, "Login failed: database schema out of date.");
            return StatusCode(500, new
            {
                message =
                    "Database schema is out of date. On the API server run: dotnet ef database update --project OpenSkyHRM.Persistence --startup-project OpenSkyHRM.Api, then restart the API."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed unexpectedly.");
            var hint = _env.IsDevelopment()
                ? ex.GetBaseException().Message
                : null;
            return StatusCode(500, new
            {
                message = "Sign-in failed. Check API logs or database connectivity.",
                detail = hint
            });
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
            ? AdminBootstrapSeeder.DefaultAdminPassword
            : body.Password!;

        await AdminBootstrapSeeder.EnsureAsync(
            db,
            AdminBootstrapSeeder.DefaultAdminUsername,
            AdminBootstrapSeeder.DefaultAdminEmail,
            password,
            forceResetPassword: true,
            cancellationToken: cancellationToken);
        return Ok(new { message = "Admin bootstrap ensured.", username = AdminBootstrapSeeder.DefaultAdminUsername });
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

    [HttpPost("forgot-password/verify")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyForgotPassword([FromBody] ForgotPasswordVerifyDto dto)
    {
        try
        {
            var result = await _authService.VerifyForgotPasswordAsync(dto);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("forgot-password/reset")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetForgotPassword([FromBody] ForgotPasswordResetDto dto)
    {
        try
        {
            await _authService.ResetPasswordWithTokenAsync(dto);
            return Ok(new { message = "Password changed successfully. You can now sign in with your new password." });
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { message = ex.Message });
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

    [HttpPost("roles")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateRole([FromBody] CreateRoleDto dto)
    {
        try
        {
            var role = await _authService.CreateRoleAsync(dto);
            return Ok(role);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
