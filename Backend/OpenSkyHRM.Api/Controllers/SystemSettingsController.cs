using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using Microsoft.Extensions.Options;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Options;
using OpenSkyHRM.Api.Services.Storage;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Domain;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Settings")]
[Route("api/system-settings")]
public class SystemSettingsController : ControllerBase
{
    private readonly ISystemSettingService _service;
    private readonly OpenAiSettingsResolver _openAi;
    private readonly IFileStorageService _files;
    private readonly FileStorageOptions _fileStorage;

    public SystemSettingsController(
        ISystemSettingService service,
        OpenAiSettingsResolver openAi,
        IFileStorageService files,
        IOptions<FileStorageOptions> fileStorage)
    {
        _service = service;
        _openAi = openAi;
        _files = files;
        _fileStorage = fileStorage.Value;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        // Preserve setting keys (e.g. CompanyName); global JsonOptions camelCase dictionary keys.
        var settings = await _service.GetAllAsync();
        if (settings.ContainsKey(OpenAiSettingsResolver.ApiKeySetting))
            settings.Remove(OpenAiSettingsResolver.ApiKeySetting);
        return new JsonResult(settings, new JsonSerializerOptions { DictionaryKeyPolicy = null });
    }

    /// <summary>OpenAI config for recruitment skill suggestions (API key is never returned).</summary>
    [HttpGet("openai")]
    public async Task<IActionResult> GetOpenAiSettings()
    {
        return Ok(await BuildOpenAiSettingsDtoAsync());
    }

    [HttpPut("openai")]
    public async Task<IActionResult> SetOpenAiSettings([FromBody] OpenAiSettingsDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.ApiKey))
            await _openAi.SetApiKeyAsync(dto.ApiKey.Trim());

        await _service.SetAsync(OpenAiSettingsResolver.ModelSetting, string.IsNullOrWhiteSpace(dto.Model)
            ? OpenAiSettingsResolver.DefaultModel
            : dto.Model.Trim());
        await _service.SetAsync(OpenAiSettingsResolver.EnabledSetting, dto.Enabled ? "true" : "false");
        await _service.SetAsync(OpenAiSettingsResolver.SidekickEnabledSetting, dto.SidekickEnabled ? "true" : "false");
        await _service.SetAsync(OpenAiSettingsResolver.ProviderSetting, string.IsNullOrWhiteSpace(dto.Provider)
            ? OpenAiProvider.OpenAI
            : dto.Provider.Trim());
        await _service.SetAsync(OpenAiSettingsResolver.AzureEndpointSetting, dto.AzureEndpoint?.Trim() ?? "");
        await _service.SetAsync(OpenAiSettingsResolver.AzureDeploymentSetting, dto.AzureDeployment?.Trim() ?? "");
        await _service.SetAsync(OpenAiSettingsResolver.AzureApiVersionSetting, string.IsNullOrWhiteSpace(dto.AzureApiVersion)
            ? OpenAiSettingsResolver.DefaultAzureApiVersion
            : dto.AzureApiVersion.Trim());
        await _service.SetAsync(OpenAiSettingsResolver.RegionSetting, dto.Region?.Trim() ?? "");
        await _service.SetAsync(OpenAiSettingsResolver.ChatRetentionDaysSetting,
            Math.Max(1, dto.ChatRetentionDays).ToString());
        await _service.SetAsync(OpenAiSettingsResolver.AuditRetentionDaysSetting,
            Math.Max(1, dto.AuditRetentionDays).ToString());
        await _service.SetAsync(OpenAiSettingsResolver.AllowPersonalNamesSetting,
            dto.AllowPersonalNamesInLlm ? "true" : "false");

        if (dto.Enabled && !await _openAi.IsConfiguredAsync())
            return BadRequest(new { message = "Enter an OpenAI API key to enable AI skill suggestions." });

        if (string.Equals(dto.Provider, OpenAiProvider.AzureOpenAI, StringComparison.OrdinalIgnoreCase)
            && dto.Enabled
            && (string.IsNullOrWhiteSpace(dto.AzureEndpoint) || string.IsNullOrWhiteSpace(dto.AzureDeployment))
            && !await HasAzureConfigAsync())
        {
            return BadRequest(new { message = "Azure OpenAI requires endpoint and deployment name." });
        }

        return Ok(await BuildOpenAiSettingsDtoAsync());
    }

    private async Task<OpenAiSettingsDto> BuildOpenAiSettingsDtoAsync() => new()
    {
        Enabled = await _openAi.IsEnabledAsync(),
        SidekickEnabled = await _openAi.IsSidekickEnabledAsync(),
        Model = await _openAi.GetModelAsync(),
        ApiKeyConfigured = await _openAi.IsConfiguredAsync(),
        ApiKey = null,
        Provider = await _openAi.GetProviderAsync(),
        AzureEndpoint = await _openAi.GetAzureEndpointAsync(),
        AzureDeployment = await _openAi.GetAzureDeploymentAsync(),
        AzureApiVersion = await _openAi.GetAzureApiVersionAsync(),
        Region = await _openAi.GetRegionAsync(),
        ChatRetentionDays = await _openAi.GetChatRetentionDaysAsync(),
        AuditRetentionDays = await _openAi.GetAuditRetentionDaysAsync(),
        AllowPersonalNamesInLlm = await _openAi.GetAllowPersonalNamesInLlmAsync(),
    };

    private async Task<bool> HasAzureConfigAsync()
    {
        var endpoint = await _openAi.GetAzureEndpointAsync();
        var deployment = await _openAi.GetAzureDeploymentAsync();
        return !string.IsNullOrWhiteSpace(endpoint) && !string.IsNullOrWhiteSpace(deployment);
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
        if (string.Equals(key, AttendanceCheckInModes.SettingKey, StringComparison.OrdinalIgnoreCase)
            && !AttendanceCheckInModes.IsValid(dto.Value))
        {
            return BadRequest(new
            {
                message = "Invalid attendance check-in mode. Use Open, LocationGeofence, BusinessUnitQr, BusinessUnitGeofence, or Hybrid.",
            });
        }

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
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> UploadCompanyLogo(IFormFile file)
    {
        try
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded.", error = "No file uploaded." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (string.IsNullOrEmpty(ext))
                ext = file.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase) ? ".pdf" : ".png";

            var contentType = (file.ContentType ?? "").Trim().ToLowerInvariant();
            var allowedTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "application/pdf",
            };
            var allowedByExtension = ext is ".jpg" or ".jpeg" or ".png" or ".webp" or ".gif" or ".svg" or ".pdf";

            if (!allowedTypes.Contains(contentType) && !allowedByExtension)
                return BadRequest(new { message = "Only JPEG, PNG, WebP, GIF, SVG images and PDF files are allowed.", error = "Invalid file type." });

            if (ext == ".pdf" && contentType is "" or "application/octet-stream")
                contentType = "application/pdf";

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { message = "File size must be less than 5 MB.", error = "File too large." });

            if (_fileStorage.UseS3 && string.IsNullOrWhiteSpace(_fileStorage.CompanyFolder))
                return StatusCode(500, new
                {
                    message = "FileStorage:CompanyFolder is not set on this server. Add a unique folder per company (e.g. stagecafe) in appsettings.Production.json and restart the API.",
                    error = "CompanyFolder missing.",
                });

            if (_fileStorage.UseS3)
            {
                var hasConfigCreds =
                    !string.IsNullOrWhiteSpace(_fileStorage.AccessKeyId)
                    && !string.IsNullOrWhiteSpace(_fileStorage.SecretAccessKey);
                var hasEnvCreds =
                    !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_ACCESS_KEY_ID"))
                    || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_ACCESS_KEY"));
                if (!hasConfigCreds && !hasEnvCreds)
                {
                    return StatusCode(500, new
                    {
                        message = "AWS credentials are missing. Add FileStorage:AccessKeyId and SecretAccessKey to appsettings.Production.json (or appsettings.S3.json), then restart IIS.",
                        error = "AWS credentials missing.",
                    });
                }
            }

            var companyFolder = FileStoragePathHelper.SanitizeSegment(_fileStorage.ResolvedCompanyFolder);
            var fileName = $"company_logo_{companyFolder}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{ext}";
            var logoUrl = _files.BuildLogicalPath("branding", fileName);

            await using (var stream = file.OpenReadStream())
            {
                await _files.SaveAsync(logoUrl, stream, contentType);
            }

            await _service.SetAsync("CompanyLogoUrl", logoUrl);

            return Ok(new { logoUrl });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Could not upload company logo. Check FileStorage settings (S3 bucket, CompanyFolder, AWS credentials) on this server.",
                error = "Logo upload failed.",
                detail = ex.Message,
            });
        }
    }

    [HttpGet("file-storage-status")]
    public IActionResult GetFileStorageStatus()
    {
        var hasConfigCreds =
            !string.IsNullOrWhiteSpace(_fileStorage.AccessKeyId)
            && !string.IsNullOrWhiteSpace(_fileStorage.SecretAccessKey);
        var hasEnvCreds =
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_ACCESS_KEY_ID"))
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AWS_ACCESS_KEY"));
        var credentialsSource = hasConfigCreds
            ? "FileStorage:AccessKeyId in appsettings"
            : hasEnvCreds
                ? "AWS_ACCESS_KEY_ID environment variable"
                : "default (no explicit credentials — often fails on IIS)";

        return Ok(new
        {
            provider = _fileStorage.Provider,
            bucket = _fileStorage.BucketName,
            keyPrefix = _fileStorage.KeyPrefix,
            rootFolder = _fileStorage.RootFolder,
            companyFolder = _fileStorage.CompanyFolder,
            resolvedCompanyFolder = _fileStorage.ResolvedCompanyFolder,
            region = _fileStorage.Region,
            usesRemoteStorage = _files.UsesRemoteStorage,
            credentialsConfigured = hasConfigCreds || hasEnvCreds,
            credentialsSource,
            s3KeyExample = _fileStorage.UseS3
                ? $"s3://{_fileStorage.BucketName}/{FileStoragePathHelper.SanitizeSegment(_fileStorage.KeyPrefix)}/{FileStoragePathHelper.SanitizeSegment(_fileStorage.RootFolder)}/{FileStoragePathHelper.SanitizeSegment(_fileStorage.ResolvedCompanyFolder)}/Branding/"
                : null,
        });
    }

    [HttpDelete("company-logo")]
    public async Task<IActionResult> RemoveCompanyLogo()
    {
        await _service.SetAsync("CompanyLogoUrl", "");
        return Ok(new { logoUrl = "" });
    }
}

public record UpdateSettingDto(string Value);
