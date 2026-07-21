using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Common;

public class OpenAiSettingsResolver
{
    public const string ApiKeySetting = "OpenAI_ApiKey";
    public const string EnabledSetting = "OpenAI_Enabled";
    public const string ModelSetting = "OpenAI_Model";
    public const string SidekickEnabledSetting = "OpenAI_SidekickEnabled";
    public const string MaxTokensSetting = "OpenAI_MaxTokensPerRequest";
    public const string DailyQuotaSetting = "OpenAI_DailyUserQuota";
    public const string ProviderSetting = "OpenAI_Provider";
    public const string AzureEndpointSetting = "OpenAI_AzureEndpoint";
    public const string AzureDeploymentSetting = "OpenAI_AzureDeployment";
    public const string AzureApiVersionSetting = "OpenAI_AzureApiVersion";
    public const string RegionSetting = "OpenAI_Region";
    public const string ChatRetentionDaysSetting = "OpenAI_ChatRetentionDays";
    public const string AuditRetentionDaysSetting = "OpenAI_AuditRetentionDays";
    public const string AllowPersonalNamesSetting = "OpenAI_AllowPersonalNamesInLlm";

    public const string DefaultModel = "gpt-4o-mini";
    public const string DefaultAzureApiVersion = "2024-02-15-preview";
    public const int DefaultMaxTokens = 1200;
    public const int DefaultDailyQuota = 50;
    public const int DefaultChatRetentionDays = 90;
    public const int DefaultAuditRetentionDays = 365;

    private readonly IConfiguration _config;
    private readonly ISystemSettingService _settings;
    private readonly IApiKeyProtector? _protector;

    public OpenAiSettingsResolver(
        IConfiguration config,
        ISystemSettingService settings,
        IApiKeyProtector? protector = null)
    {
        _config = config;
        _settings = settings;
        _protector = protector;
    }

    public async Task<string?> GetApiKeyAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(ApiKeySetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return UnprotectKey(fromDb);

        return GetApiKeyFromConfiguration();
    }

    public async Task SetApiKeyAsync(string apiKey, CancellationToken ct = default)
    {
        var protectedValue = ProtectKey(apiKey.Trim());
        await _settings.SetAsync(ApiKeySetting, protectedValue);
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

    private string ProtectKey(string plaintext)
    {
        if (_protector == null || string.IsNullOrWhiteSpace(plaintext))
            return plaintext;
        return _protector.Protect(plaintext);
    }

    private string UnprotectKey(string stored)
    {
        if (_protector == null || string.IsNullOrWhiteSpace(stored))
            return stored;
        if (_protector.IsProtected(stored))
            return _protector.Unprotect(stored);
        return stored;
    }

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
        if (string.Equals(await GetProviderAsync(ct), OpenAiProvider.AzureOpenAI, StringComparison.OrdinalIgnoreCase))
        {
            var deployment = (await _settings.GetAsync(AzureDeploymentSetting))?.Trim();
            if (!string.IsNullOrWhiteSpace(deployment))
                return deployment;

            var configDeployment = _config["OpenAI:AzureDeployment"]?.Trim();
            if (!string.IsNullOrWhiteSpace(configDeployment))
                return configDeployment;
        }

        var fromDb = (await _settings.GetAsync(ModelSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return string.IsNullOrWhiteSpace(_config["OpenAI:Model"])
            ? DefaultModel
            : _config["OpenAI:Model"]!.Trim();
    }

    public async Task<bool> IsSidekickEnabledAsync(CancellationToken ct = default)
    {
        if (!await IsConfiguredAsync(ct))
            return false;

        var dbFlag = (await _settings.GetAsync(SidekickEnabledSetting))?.Trim();
        if (string.Equals(dbFlag, "false", StringComparison.OrdinalIgnoreCase))
            return false;
        if (string.Equals(dbFlag, "true", StringComparison.OrdinalIgnoreCase))
            return true;

        var configFlag = _config["OpenAI:SidekickEnabled"];
        if (string.Equals(configFlag, "false", StringComparison.OrdinalIgnoreCase))
            return false;

        return true;
    }

    public async Task<int> GetMaxTokensPerRequestAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(MaxTokensSetting))?.Trim();
        if (int.TryParse(fromDb, out var parsed) && parsed > 0)
            return parsed;

        if (int.TryParse(_config["OpenAI:MaxTokensPerRequest"], out var configParsed) && configParsed > 0)
            return configParsed;

        return DefaultMaxTokens;
    }

    public async Task<int> GetDailyUserQuotaAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(DailyQuotaSetting))?.Trim();
        if (int.TryParse(fromDb, out var parsed) && parsed > 0)
            return parsed;

        if (int.TryParse(_config["OpenAI:DailyUserQuota"], out var configParsed) && configParsed > 0)
            return configParsed;

        return DefaultDailyQuota;
    }

    public async Task<string> GetProviderAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(ProviderSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return NormalizeProvider(fromDb);

        var fromConfig = _config["OpenAI:Provider"]?.Trim();
        if (!string.IsNullOrWhiteSpace(fromConfig))
            return NormalizeProvider(fromConfig);

        return OpenAiProvider.OpenAI;
    }

    public async Task<string?> GetAzureEndpointAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(AzureEndpointSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return _config["OpenAI:AzureEndpoint"]?.Trim();
    }

    public async Task<string?> GetAzureDeploymentAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(AzureDeploymentSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return _config["OpenAI:AzureDeployment"]?.Trim();
    }

    public async Task<string> GetAzureApiVersionAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(AzureApiVersionSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return string.IsNullOrWhiteSpace(_config["OpenAI:AzureApiVersion"])
            ? DefaultAzureApiVersion
            : _config["OpenAI:AzureApiVersion"]!.Trim();
    }

    public async Task<string?> GetRegionAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(RegionSetting))?.Trim();
        if (!string.IsNullOrWhiteSpace(fromDb))
            return fromDb;

        return _config["OpenAI:Region"]?.Trim();
    }

    public async Task<int> GetChatRetentionDaysAsync(CancellationToken ct = default) =>
        await GetIntSettingAsync(ChatRetentionDaysSetting, "OpenAI:ChatRetentionDays", DefaultChatRetentionDays, ct);

    public async Task<int> GetAuditRetentionDaysAsync(CancellationToken ct = default) =>
        await GetIntSettingAsync(AuditRetentionDaysSetting, "OpenAI:AuditRetentionDays", DefaultAuditRetentionDays, ct);

    public async Task<bool> GetAllowPersonalNamesInLlmAsync(CancellationToken ct = default)
    {
        var fromDb = (await _settings.GetAsync(AllowPersonalNamesSetting))?.Trim();
        if (string.Equals(fromDb, "true", StringComparison.OrdinalIgnoreCase))
            return true;
        if (string.Equals(fromDb, "false", StringComparison.OrdinalIgnoreCase))
            return false;

        var fromConfig = _config["OpenAI:AllowPersonalNamesInLlm"];
        if (string.Equals(fromConfig, "true", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    public async Task<bool> HasDatabaseApiKeyAsync(CancellationToken ct = default) =>
        !string.IsNullOrWhiteSpace((await _settings.GetAsync(ApiKeySetting))?.Trim());

    public async Task<OpenAiPrivacySnapshot> GetPrivacySnapshotAsync(CancellationToken ct = default) =>
        new()
        {
            Provider = await GetProviderAsync(ct),
            Region = await GetRegionAsync(ct),
            ChatRetentionDays = await GetChatRetentionDaysAsync(ct),
            AuditRetentionDays = await GetAuditRetentionDaysAsync(ct),
            AllowPersonalNamesInLlm = await GetAllowPersonalNamesInLlmAsync(ct),
        };

    private async Task<int> GetIntSettingAsync(string dbKey, string configKey, int defaultValue, CancellationToken ct)
    {
        var fromDb = (await _settings.GetAsync(dbKey))?.Trim();
        if (int.TryParse(fromDb, out var parsed) && parsed > 0)
            return parsed;

        if (int.TryParse(_config[configKey], out var configParsed) && configParsed > 0)
            return configParsed;

        return defaultValue;
    }

    private static string NormalizeProvider(string value) =>
        string.Equals(value, OpenAiProvider.AzureOpenAI, StringComparison.OrdinalIgnoreCase)
            ? OpenAiProvider.AzureOpenAI
            : OpenAiProvider.OpenAI;
}

public class OpenAiPrivacySnapshot
{
    public string Provider { get; set; } = OpenAiProvider.OpenAI;
    public string? Region { get; set; }
    public int ChatRetentionDays { get; set; } = OpenAiSettingsResolver.DefaultChatRetentionDays;
    public int AuditRetentionDays { get; set; } = OpenAiSettingsResolver.DefaultAuditRetentionDays;
    public bool AllowPersonalNamesInLlm { get; set; }
}
