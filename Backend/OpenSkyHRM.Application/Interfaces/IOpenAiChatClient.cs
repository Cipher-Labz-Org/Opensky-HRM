using System.Text.Json;

namespace OpenSkyHRM.Application.Interfaces;

public interface IOpenAiChatClient
{
    Task<JsonDocument> ChatCompletionsAsync(
        IReadOnlyList<object> messages,
        IReadOnlyList<object>? tools = null,
        object? toolChoice = null,
        double temperature = 0.2,
        int? maxTokens = null,
        object? responseFormat = null,
        CancellationToken ct = default);

    Task<string> GetCompletionContentAsync(
        IReadOnlyList<object> messages,
        double temperature = 0.4,
        object? responseFormat = null,
        CancellationToken ct = default);
}
