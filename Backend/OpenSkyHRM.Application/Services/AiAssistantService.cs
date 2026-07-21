using System.Text.Json;

using System.Text.RegularExpressions;

using Microsoft.Extensions.Logging;

using OpenSkyHRM.Application.Common;

using OpenSkyHRM.Application.DTOs.AiAssistant;

using OpenSkyHRM.Application.Interfaces;



namespace OpenSkyHRM.Application.Services;



public class AiAssistantService : IAiAssistantService

{

    private const int MaxToolRounds = 3;

    private const int MaxHistoryMessages = 20;

    private static readonly Regex SuggestionsRegex = new(

        @"<!--SUGGESTIONS:(\[.*?\])-->",

        RegexOptions.Singleline | RegexOptions.Compiled);



    private readonly AiConversationService _conversations;

    private readonly IAiContextBuilder _contextBuilder;

    private readonly IAiToolRegistry _toolRegistry;

    private readonly IAiToolExecutor _toolExecutor;

    private readonly OpenAiSettingsResolver _openAi;

    private readonly IOpenAiChatClient _chatClient;

    private readonly AiLlmPayloadSanitizer _sanitizer;

    private readonly ILogger<AiAssistantService> _logger;



    public AiAssistantService(

        AiConversationService conversations,

        IAiContextBuilder contextBuilder,

        IAiToolRegistry toolRegistry,

        IAiToolExecutor toolExecutor,

        OpenAiSettingsResolver openAi,

        IOpenAiChatClient chatClient,

        AiLlmPayloadSanitizer sanitizer,

        ILogger<AiAssistantService> logger)

    {

        _conversations = conversations;

        _contextBuilder = contextBuilder;

        _toolRegistry = toolRegistry;

        _toolExecutor = toolExecutor;

        _openAi = openAi;

        _chatClient = chatClient;

        _sanitizer = sanitizer;

        _logger = logger;

    }



    public async Task<AiAssistantStatusDto> GetStatusAsync(AiUserContext user, CancellationToken ct = default) =>

        new()

        {

            Configured = await _openAi.IsConfiguredAsync(ct),

            Enabled = await _openAi.IsEnabledAsync(ct),

            SidekickEnabled = await _openAi.IsSidekickEnabledAsync(ct),

            Licensed = user.LicensedModules.Any(m => string.Equals(m, "AiAssistant", StringComparison.OrdinalIgnoreCase)),

            LicensedModules = user.LicensedModules,

        };



    public async Task<AiChatResponseDto> ChatAsync(AiUserContext user, AiChatRequestDto request, CancellationToken ct = default)

    {

        if (!await _openAi.IsSidekickEnabledAsync(ct))

            throw new InvalidOperationException(

                "OpenSky AI is not enabled. Configure OpenAI under Policy & Settings and enable OpenSky AI.");



        var message = request.Message?.Trim() ?? "";

        if (message.Length == 0)

            throw new InvalidOperationException("Enter a message.");



        var dailyQuota = await _openAi.GetDailyUserQuotaAsync(ct);

        var todayCount = await _conversations.CountUserMessagesTodayAsync(user.UserId, ct);

        if (todayCount >= dailyQuota)

            throw new InvalidOperationException($"Daily AI message limit reached ({dailyQuota}). Try again tomorrow.");



        var conv = await _conversations.GetOrCreateConversationAsync(user.UserId, request.ConversationId, message, ct);

        await _conversations.AddMessageAsync(conv.Id, "user", message, request.PageContext, ct);



        var history = await _conversations.GetRecentMessagesAsync(conv.Id, MaxHistoryMessages, ct);

        var tools = _toolRegistry.GetAvailableTools(user);

        var preferredTool = AiSidekickToolRouter.InferPreferredTool(message, tools.Select(t => t.Name).ToHashSet());

        var prefetch = await TryPrefetchToolDataAsync(conv.Id, user, tools, preferredTool, ct);

        var prefetchedData = prefetch.Success ? prefetch.Content : null;



        var systemPrompt = _contextBuilder.BuildSystemPrompt(user, request.PageContext);

        if (prefetchedData != null)

        {

            systemPrompt += """



                Pre-fetched live HR data for this question (use these facts in your answer):

                """ + prefetchedData;

        }



        systemPrompt = await _sanitizer.SanitizeSystemPromptAsync(systemPrompt, ct);

        var llmMessages = BuildLlmMessages(systemPrompt, history);

        var openAiTools = prefetchedData == null ? BuildOpenAiToolDefinitions(tools) : [];



        string finalText = "";

        for (var round = 0; round < MaxToolRounds; round++)

        {

            var requireToolCall = prefetchedData == null && round == 0 && openAiTools.Count > 0;

            var toolChoice = prefetchedData == null && round == 0 ? preferredTool : null;

            object? toolChoicePayload = null;

            if (!string.IsNullOrWhiteSpace(toolChoice))

            {

                toolChoicePayload = new Dictionary<string, object?>

                {

                    ["type"] = "function",

                    ["function"] = new Dictionary<string, string> { ["name"] = toolChoice! },

                };

            }

            else if (requireToolCall)

            {

                toolChoicePayload = "required";

            }



            using var response = await _chatClient.ChatCompletionsAsync(

                llmMessages,

                openAiTools.Count > 0 ? openAiTools : null,

                toolChoicePayload,

                ct: ct);

            var choice = response.RootElement.GetProperty("choices")[0].GetProperty("message");



            if (choice.TryGetProperty("tool_calls", out var toolCallsEl) && toolCallsEl.ValueKind == JsonValueKind.Array

                && toolCallsEl.GetArrayLength() > 0)

            {

                llmMessages.Add(JsonSerializer.Deserialize<object>(choice.GetRawText())!);



                foreach (var call in toolCallsEl.EnumerateArray())

                {

                    var toolName = call.GetProperty("function").GetProperty("name").GetString() ?? "";

                    var toolCallId = call.GetProperty("id").GetString() ?? Guid.NewGuid().ToString("N");

                    var argsJson = call.GetProperty("function").GetProperty("arguments").GetString() ?? "{}";



                    using var argsDoc = JsonDocument.Parse(argsJson);

                    var tool = tools.FirstOrDefault(t => t.Name == toolName);

                    AiToolResult toolResult;

                    if (tool == null)

                    {

                        toolResult = AiToolResult.Denied($"Tool '{toolName}' is not available.");

                    }

                    else

                    {

                        toolResult = await _toolExecutor.ExecuteAsync(tool, user, argsDoc.RootElement, ct);

                    }



                    var modelContent = await _sanitizer.FormatForModelAsync(toolResult, ct);

                    llmMessages.Add(new Dictionary<string, object?>

                    {

                        ["role"] = "tool",

                        ["tool_call_id"] = toolCallId,

                        ["content"] = modelContent,

                    });



                    var storedContent = await _sanitizer.SanitizeForStorageAsync(toolResult, ct);

                    await _conversations.AddMessageAsync(conv.Id, "tool", storedContent, new { toolName }, ct);

                }



                continue;

            }



            finalText = choice.TryGetProperty("content", out var contentEl) && contentEl.ValueKind == JsonValueKind.String

                ? contentEl.GetString()?.Trim() ?? ""

                : "";



            if (finalText.Length == 0)

                finalText = "I couldn't generate a response. Please try rephrasing your question.";



            break;

        }



        if (string.IsNullOrWhiteSpace(finalText))

            finalText = "I reached the tool call limit. Please try a simpler question.";



        var (answer, suggestions) = ParseSuggestions(finalText);

        var assistantMsg = await _conversations.AddMessageAsync(conv.Id, "assistant", answer, new { suggestedActions = suggestions }, ct);



        return new AiChatResponseDto

        {

            ConversationId = conv.Id,

            MessageId = assistantMsg.Id,

            Answer = answer,

            SuggestedActions = suggestions,

        };

    }



    private static List<object> BuildLlmMessages(string systemPrompt, IReadOnlyList<Domain.Entities.AiMessage> history)

    {

        var messages = new List<object> { new { role = "system", content = systemPrompt } };

        foreach (var m in history.Where(x => x.Role is "user" or "assistant"))

        {

            messages.Add(new { role = m.Role, content = m.Content });

        }

        return messages;

    }



    private static List<object> BuildOpenAiToolDefinitions(IReadOnlyList<IAiTool> tools)

    {

        return tools.Select(t => (object)new

        {

            type = "function",

            function = new

            {

                name = t.Name,

                description = t.Description,

                parameters = JsonSerializer.Deserialize<object>(t.InputSchema.RootElement.GetRawText()),

            },

        }).ToList();

    }



    private async Task<(string? Content, bool Success)> TryPrefetchToolDataAsync(

        Guid conversationId,

        AiUserContext user,

        IReadOnlyList<IAiTool> tools,

        string? preferredTool,

        CancellationToken ct)

    {

        if (string.IsNullOrWhiteSpace(preferredTool))

            return (null, false);



        var tool = tools.FirstOrDefault(t => t.Name == preferredTool);

        if (tool == null)

            return (null, false);



        using var emptyArgs = JsonDocument.Parse("{}");

        var toolResult = await _toolExecutor.ExecuteAsync(tool, user, emptyArgs.RootElement, ct);

        var storedContent = await _sanitizer.SanitizeForStorageAsync(toolResult, ct);

        await _conversations.AddMessageAsync(conversationId, "tool", storedContent, new { toolName = preferredTool }, ct);

        var modelContent = await _sanitizer.FormatForModelAsync(toolResult, ct);

        return (modelContent, toolResult.Success);

    }



    private static (string Answer, IReadOnlyList<string> Suggestions) ParseSuggestions(string text)

    {

        var match = SuggestionsRegex.Match(text);

        if (!match.Success)

            return (text.Trim(), Array.Empty<string>());



        var answer = text[..match.Index].Trim();

        try

        {

            var suggestions = JsonSerializer.Deserialize<List<string>>(match.Groups[1].Value) ?? [];

            return (answer, suggestions.Where(s => !string.IsNullOrWhiteSpace(s)).Take(4).ToList());

        }

        catch

        {

            return (answer, Array.Empty<string>());

        }

    }

}


