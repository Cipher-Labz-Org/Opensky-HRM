using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Options;
using OpenSkyHRM.Api.Services.Storage;
using QRCoder;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MobileController : ControllerBase
{
    private readonly ISystemSettingService _systemSettings;
    private readonly IConfiguration _config;
    private readonly FileStorageOptions _fileStorage;

    public MobileController(
        ISystemSettingService systemSettings,
        IConfiguration config,
        IOptions<FileStorageOptions> fileStorage)
    {
        _systemSettings = systemSettings;
        _config = config;
        _fileStorage = fileStorage.Value;
    }

    /// <summary>Public connection metadata for the mobile app (no secrets).</summary>
    [HttpGet("connection-info")]
    [AllowAnonymous]
    public async Task<IActionResult> GetConnectionInfo()
    {
        var apiBaseUrl = ResolvePublicApiBaseUrl();
        var companyName = (await _systemSettings.GetAsync("CompanyName") ?? "").Trim();
        var logo = (await _systemSettings.GetAsync("CompanyLogoUrl") ?? "").Trim();

        return Ok(new
        {
            apiBaseUrl,
            companyName = string.IsNullOrEmpty(companyName) ? "OpenSky HRM" : companyName,
            companyLogoUrl = string.IsNullOrEmpty(logo) ? null : logo,
            companyId = FileStoragePathHelper.SanitizeSegment(_fileStorage.ResolvedCompanyFolder),
        });
    }

    /// <summary>PNG QR code encoding the mobile deep link for scan-to-connect.</summary>
    [HttpGet("connection-qr")]
    [AllowAnonymous]
    public async Task<IActionResult> GetConnectionQr([FromQuery] int pixelsPerModule = 8)
    {
        var info = await BuildConnectionPayloadAsync();
        var deepLink =
            $"openskyhrm://connect?u={Uri.EscapeDataString(info.ApiBaseUrl)}&c={Uri.EscapeDataString(info.CompanyName)}&id={Uri.EscapeDataString(info.CompanyId)}";
        if (!string.IsNullOrEmpty(info.CompanyLogoUrl))
        {
            deepLink += $"&l={Uri.EscapeDataString(info.CompanyLogoUrl)}";
        }

        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(deepLink, QRCodeGenerator.ECCLevel.Q);
        var png = new PngByteQRCode(data);
        var bytes = png.GetGraphic(Math.Clamp(pixelsPerModule, 4, 20));
        return File(bytes, "image/png");
    }

    private async Task<(string ApiBaseUrl, string CompanyName, string? CompanyLogoUrl, string CompanyId)> BuildConnectionPayloadAsync()
    {
        var apiBaseUrl = ResolvePublicApiBaseUrl();
        var companyName = (await _systemSettings.GetAsync("CompanyName") ?? "").Trim();
        var logo = (await _systemSettings.GetAsync("CompanyLogoUrl") ?? "").Trim();
        return (
            apiBaseUrl,
            string.IsNullOrEmpty(companyName) ? "OpenSky HRM" : companyName,
            string.IsNullOrEmpty(logo) ? null : logo,
            FileStoragePathHelper.SanitizeSegment(_fileStorage.ResolvedCompanyFolder));
    }

    private string ResolvePublicApiBaseUrl() =>
        PublicApiUrlResolver.Resolve(_config, Request);
}
