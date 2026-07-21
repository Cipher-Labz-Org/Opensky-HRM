using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAiAssistantService
{
    Task<AiAssistantStatusDto> GetStatusAsync(AiUserContext user, CancellationToken ct = default);
    Task<AiChatResponseDto> ChatAsync(AiUserContext user, AiChatRequestDto request, CancellationToken ct = default);
}

public interface IAiConversationService
{
    Task<IReadOnlyList<AiConversationSummaryDto>> ListConversationsAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<AiMessageDto>> GetMessagesAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
    Task DeleteConversationAsync(Guid userId, Guid conversationId, CancellationToken ct = default);
    Task SetFeedbackAsync(Guid userId, Guid messageId, int rating, CancellationToken ct = default);
}

public interface IAiToolRegistry
{
    IReadOnlyList<IAiTool> GetAvailableTools(AiUserContext user);
}

public interface IAiToolExecutor
{
    Task<AiToolResult> ExecuteAsync(IAiTool tool, AiUserContext user, JsonElement args, CancellationToken ct);
}

public interface IAiContextBuilder
{
    string BuildSystemPrompt(AiUserContext user, AiPageContextDto? pageContext);
}

public interface IAiAuditLogger
{
    Task LogAsync(Guid userId, string toolName, string argsRedactedJson, string resultSummary, CancellationToken ct = default);
}

public interface IPeopleScopeService
{
    Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(AiUserContext user, string action = "Read", CancellationToken ct = default);
    Task<bool> CanAccessEmployeeAsync(AiUserContext user, Guid employeeId, string action = "Read", CancellationToken ct = default);
    string ResolvePeopleScope(AiUserContext user, string action = "Read");
}
