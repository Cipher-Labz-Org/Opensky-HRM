using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;
using QRCoder;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MobileController : ControllerBase
{
    private readonly ISystemSettingService _systemSettings;
    private readonly IConfiguration _config;

    public MobileController(ISystemSettingService systemSettings, IConfiguration config)
    {
        _systemSettings = systemSettings;
        _config = config;
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
            companyId = "default"
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
            "default");
    }

    private string ResolvePublicApiBaseUrl()
    {
        var configured = (_config["Mobile:PublicApiBaseUrl"] ?? "").Trim();
        if (!string.IsNullOrEmpty(configured))
        {
            return configured.TrimEnd('/');
        }

        var forwardedHost = Request.Headers["X-Forwarded-Host"].FirstOrDefault();
        var forwardedProto = Request.Headers["X-Forwarded-Proto"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwardedHost))
        {
            var scheme = string.IsNullOrWhiteSpace(forwardedProto) ? Request.Scheme : forwardedProto;
            return $"{scheme}://{forwardedHost}".TrimEnd('/');
        }

        var request = HttpContext.Request;
        return $"{request.Scheme}://{request.Host.Value}".TrimEnd('/');
    }
}
