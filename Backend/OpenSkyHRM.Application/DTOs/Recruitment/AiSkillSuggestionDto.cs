namespace OpenSkyHRM.Application.DTOs.Recruitment;

using OpenSkyHRM.Application.Common;

public class AiSkillSuggestionRequestDto
{
    public string Title { get; set; } = string.Empty;
    public Guid? JobTitleId { get; set; }
    public Guid? DepartmentId { get; set; }
}

public class AiSkillSuggestionResultDto
{
    public List<string> Skills { get; set; } = [];
    public bool FromCache { get; set; }
    public string Source { get; set; } = "ai";
}

public class AiSkillSuggestionStatusDto
{
    public bool Enabled { get; set; }
    public bool Configured { get; set; }
}

public class OpenAiSettingsDto
{
    public bool Enabled { get; set; } = true;
    public bool SidekickEnabled { get; set; } = true;
    public string Model { get; set; } = OpenAiSettingsResolver.DefaultModel;
    /// <summary>When null or whitespace on update, existing key is kept.</summary>
    public string? ApiKey { get; set; }
    public bool ApiKeyConfigured { get; set; }
    public string Provider { get; set; } = OpenAiProvider.OpenAI;
    public string? AzureEndpoint { get; set; }
    public string? AzureDeployment { get; set; }
    public string AzureApiVersion { get; set; } = OpenAiSettingsResolver.DefaultAzureApiVersion;
    public string? Region { get; set; }
    public int ChatRetentionDays { get; set; } = OpenAiSettingsResolver.DefaultChatRetentionDays;
    public int AuditRetentionDays { get; set; } = OpenAiSettingsResolver.DefaultAuditRetentionDays;
    public bool AllowPersonalNamesInLlm { get; set; }
}
