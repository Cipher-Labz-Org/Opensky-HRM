using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Settings")]
[Route("api/system-settings")]
public class SystemSettingsController : ControllerBase
{
    private readonly ISystemSettingService _service;
    private readonly IFileStorageService _files;

    public SystemSettingsController(ISystemSettingService service, IFileStorageService files)
    {
        _service = service;
        _files = files;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // Preserve setting keys (e.g. CompanyName); global JsonOptions camelCase dictionary keys.
        var settings = await _service.GetAllAsync();
        return new JsonResult(settings, new JsonSerializerOptions { DictionaryKeyPolicy = null });
    }

    /// <summary>Must be registered before the literal route so "email-delivery-logs" is not handled as a setting key (404).</summary>
    [HttpGet("email-delivery-logs")]
    public async Task<IActionResult> GetEmailDeliveryLogs(
        [FromServices] ISettingsService settingsService,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? status = null)
        => Ok(await settingsService.GetOutboundEmailLogsAsync(page, pageSize, status));

    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var value = await _service.GetAsync(key);
        if (value is null) return NotFound();
        return Ok(new { key, value });
    }

    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] UpdateSettingDto dto)
    {
        await _service.SetAsync(key, dto.Value);
        return Ok(new { key, value = dto.Value });
    }

    [HttpGet("next-employee-code")]
    public async Task<IActionResult> GetNextEmployeeCode()
    {
        var code = await _service.GenerateNextEmployeeCodeAsync();
        return Ok(new { code });
    }

    [HttpPost("company-logo")]
    public async Task<IActionResult> UploadCompanyLogo(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            return BadRequest(new { error = "Only JPEG, PNG, WebP, GIF and SVG images are allowed." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { error = "File size must be less than 5 MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext)) ext = ".png";
        var fileName = $"company_logo_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";
        var logoUrl = _files.BuildLogicalPath("branding", fileName);

        await using (var stream = file.OpenReadStream())
        {
            await _files.SaveAsync(logoUrl, stream, file.ContentType);
        }

        await _service.SetAsync("CompanyLogoUrl", logoUrl);

        return Ok(new { logoUrl });
    }

    [HttpDelete("company-logo")]
    public async Task<IActionResult> RemoveCompanyLogo()
    {
        await _service.SetAsync("CompanyLogoUrl", "");
        return Ok(new { logoUrl = "" });
    }
}

public record UpdateSettingDto(string Value);
