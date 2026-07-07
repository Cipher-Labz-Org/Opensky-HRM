using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Common;

public class OpenAiSettingsResolver
{
    public const string ApiKeySetting = "OpenAI_ApiKey";
    public const string EnabledSetting = "OpenAI_Enabled";
    public const string ModelSetting = "OpenAI_Model";
    public const string DefaultModel = "gpt-4o-mini";

    private readonly IConfiguration _config;
    private readonly ISystemSettingService _settings;

    public OpenAiSettingsResolver(IConfiguration config, ISystemSettingService settings)
    {
        _config = config;
        _settings = settings;
    }

    public async Task<string?> GetApiKeyAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(ApiKeySetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return GetApiKeyFromConfiguration();
    }

    public static string? GetApiKeyFromConfiguration(IConfiguration config)
    {
        var v = config["OpenAI:ApiKey"];
        if (!string.IsNullOrWhiteSpace(v))
            return v.Trim();

        var env = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (!string.IsNullOrWhiteSpace(env))
            return env.Trim();

        var nested = Environment.GetEnvironmentVariable("OpenAI__ApiKey");
        if (!string.IsNullOrWhiteSpace(nested))
            return nested.Trim();

        return null;
    }

    private string? GetApiKeyFromConfiguration() => GetApiKeyFromConfiguration(_config);

    public async Task<bool> IsConfiguredAsync(CancellationToken ct = default) =>
        !string.IsNullOrWhiteSpace(await GetApiKeyAsync(ct));

    public async Task<bool> IsEnabledAsync(CancellationToken ct = default)
    {
        var dbFlag = (await _settings.GetAsync(EnabledSetting))?.Trim();
        if (string.Equals(dbFlag, "false", StringComparison.OrdinalIgnoreCase))
            return false;
        if (string.Equals(dbFlag, "true", StringComparison.OrdinalIgnoreCase))
            return await IsConfiguredAsync(ct);

        var configFlag = _config["OpenAI:Enabled"];
        if (string.Equals(configFlag, "false", StringComparison.OrdinalIgnoreCase))
            return false;

        return await IsConfiguredAsync(ct);
    }

    public async Task<string> GetModelAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(ModelSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return string.IsNullOrWhiteSpace(_config["OpenAI:Model"])
            ? DefaultModel
            : _config["OpenAI:Model"]!.Trim();
    }

    public async Task<bool> HasDatabaseApiKeyAsync(CancellationToken ct = default) =>
        !string.IsNullOrWhiteSpace((await _settings.GetAsync(ApiKeySetting))?.Trim());
}
