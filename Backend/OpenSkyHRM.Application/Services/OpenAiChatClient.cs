using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services;

public sealed class OpenAiChatClient : IOpenAiChatClient
{
    private readonly OpenAiSettingsResolver _settings;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OpenAiChatClient> _logger;

    public OpenAiChatClient(
        OpenAiSettingsResolver settings,
        IHttpClientFactory httpClientFactory,
        ILogger<OpenAiChatClient> logger)
    {
        _settings = settings;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<JsonDocument> ChatCompletionsAsync(
        IReadOnlyList<object> messages,
        IReadOnlyList<object>? tools = null,
        object? toolChoice = null,
        double temperature = 0.2,
        int? maxTokens = null,
        object? responseFormat = null,
        CancellationToken ct = default)
    {
        var payload = await BuildPayload(messages, tools, toolChoice, temperature, maxTokens, responseFormat, ct);
        return await PostChatCompletionsAsync(payload, ct);
    }

    public async Task<string> GetCompletionContentAsync(
        IReadOnlyList<object> messages,
        double temperature = 0.4,
        object? responseFormat = null,
        CancellationToken ct = default)
    {
        using var doc = await ChatCompletionsAsync(messages, temperature: temperature, responseFormat: responseFormat, ct: ct);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";
    }

    internal async Task<JsonDocument> PostChatCompletionsAsync(Dictionary<string, object?> payload, CancellationToken ct)
    {
        var apiKey = (await _settings.GetApiKeyAsync(ct))!;
        var provider = await _settings.GetProviderAsync(ct);
        var (url, useApiKeyHeader) = await BuildRequestUrlAsync(provider, ct);

        var client = _httpClientFactory.CreateClient(nameof(OpenAiChatClient));
        client.Timeout = TimeSpan.FromSeconds(90);
        client.DefaultRequestHeaders.Clear();
        if (useApiKeyHeader)
            client.DefaultRequestHeaders.Add("api-key", apiKey);
        else
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var httpContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync(url, httpContent, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("LLM chat failed ({Status}, provider={Provider}): {Body}",
                (int)response.StatusCode, provider, body.Length > 500 ? body[..500] : body);
            throw new InvalidOperationException(FormatError(response.StatusCode, body));
        }

        return JsonDocument.Parse(body);
    }

    private async Task<Dictionary<string, object?>> BuildPayload(
        IReadOnlyList<object> messages,
        IReadOnlyList<object>? tools,
        object? toolChoice,
        double temperature,
        int? maxTokens,
        object? responseFormat,
        CancellationToken ct)
    {
        var provider = await _settings.GetProviderAsync(ct);
        var max = maxTokens ?? await _settings.GetMaxTokensPerRequestAsync(ct);

        var payload = new Dictionary<string, object?>
        {
            ["temperature"] = temperature,
            ["max_tokens"] = max,
            ["messages"] = messages,
        };

        if (string.Equals(provider, OpenAiProvider.AzureOpenAI, StringComparison.OrdinalIgnoreCase))
        {
            // Azure uses deployment from URL; model field omitted.
        }
        else
        {
            payload["model"] = await _settings.GetModelAsync(ct);
        }

        if (tools is { Count: > 0 })
        {
            payload["tools"] = tools;
            if (toolChoice != null)
                payload["tool_choice"] = toolChoice;
        }

        if (responseFormat != null)
            payload["response_format"] = responseFormat;

        return payload;
    }

    public async Task<(string Url, bool UseApiKeyHeader)> BuildRequestUrlAsync(string provider, CancellationToken ct = default)
    {
        if (string.Equals(provider, OpenAiProvider.AzureOpenAI, StringComparison.OrdinalIgnoreCase))
        {
            var endpoint = (await _settings.GetAzureEndpointAsync(ct))?.Trim().TrimEnd('/');
            var deployment = (await _settings.GetAzureDeploymentAsync(ct))?.Trim();
            var apiVersion = await _settings.GetAzureApiVersionAsync(ct);

            if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(deployment))
                throw new InvalidOperationException(
                    "Azure OpenAI endpoint and deployment are required. Configure them under Policy & Settings → OpenAI.");

            var url = $"{endpoint}/openai/deployments/{Uri.EscapeDataString(deployment)}/chat/completions?api-version={Uri.EscapeDataString(apiVersion)}";
            return (url, true);
        }

        return ("https://api.openai.com/v1/chat/completions", false);
    }

    internal static string FormatError(System.Net.HttpStatusCode status, string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err)
                && err.TryGetProperty("message", out var msg)
                && msg.ValueKind == JsonValueKind.String)
            {
                var text = msg.GetString();
                if (!string.IsNullOrWhiteSpace(text))
                    return status == System.Net.HttpStatusCode.Unauthorized
                        ? "API key is invalid. Check Policy & Settings → OpenAI."
                        : $"AI provider: {text}";
            }
        }
        catch { /* ignore */ }

        return status == System.Net.HttpStatusCode.Unauthorized
            ? "API key is invalid. Check Policy & Settings → OpenAI."
            : "AI request failed. Try again later.";
    }
}
