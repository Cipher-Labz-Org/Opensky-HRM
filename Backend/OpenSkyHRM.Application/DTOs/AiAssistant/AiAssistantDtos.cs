namespace OpenSkyHRM.Application.DTOs.AiAssistant;

public class AiAssistantStatusDto
{
    public bool Configured { get; set; }
    public bool Enabled { get; set; }
    public bool SidekickEnabled { get; set; }
    public bool Licensed { get; set; }
    public IReadOnlyList<string> LicensedModules { get; set; } = Array.Empty<string>();
}

public class AiPageContextDto
{
    public string Pathname { get; set; } = string.Empty;
    public string ModuleCode { get; set; } = string.Empty;
    public string ModuleLabel { get; set; } = string.Empty;
}

public class AiChatRequestDto
{
    public Guid? ConversationId { get; set; }
    public string Message { get; set; } = string.Empty;
    public AiPageContextDto? PageContext { get; set; }
}

public class AiChatResponseDto
{
    public Guid ConversationId { get; set; }
    public Guid MessageId { get; set; }
    public string Answer { get; set; } = string.Empty;
    public IReadOnlyList<string> SuggestedActions { get; set; } = Array.Empty<string>();
}

public class AiConversationSummaryDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class AiMessageDto
{
    public Guid Id { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public IReadOnlyList<string> SuggestedActions { get; set; } = Array.Empty<string>();
}

public class AiMessageFeedbackDto
{
    public int Rating { get; set; }
}

public class AiPrivacyNoticeDto
{
    public string Notice { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string? Region { get; set; }
    public int ChatRetentionDays { get; set; }
    public int AuditRetentionDays { get; set; }
    public bool AllowPersonalNamesInLlm { get; set; }
}

public class AiUserContext
{
    public Guid UserId { get; set; }
    public Guid? EmployeeId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? EmployeeName { get; set; }
    public IReadOnlyList<string> Roles { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> Permissions { get; set; } = Array.Empty<string>();
    public IReadOnlyList<string> LicensedModules { get; set; } = Array.Empty<string>();
}

public class AiToolResult
{
    public bool Success { get; set; }
    public string Json { get; set; } = "{}";
    public string Summary { get; set; } = string.Empty;
    public string? DenialReason { get; set; }

    public static AiToolResult Ok(object data, string summary) =>
        new()
        {
            Success = true,
            Json = System.Text.Json.JsonSerializer.Serialize(data),
            Summary = summary,
        };

    public static AiToolResult Denied(string reason) =>
        new()
        {
            Success = false,
            DenialReason = reason,
            Summary = reason,
            Json = System.Text.Json.JsonSerializer.Serialize(new { denied = true, reason }),
        };
}
