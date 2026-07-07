using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class OpenAiSkillSuggestionService : IOpenAiSkillSuggestionService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromDays(7);

    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly OpenAiSettingsResolver _openAi;
    private readonly IMemoryCache _cache;
    private readonly ILogger<OpenAiSkillSuggestionService> _logger;

    public OpenAiSkillSuggestionService(
        AppDbContext db,
        IHttpClientFactory httpClientFactory,
        OpenAiSettingsResolver openAi,
        IMemoryCache cache,
        ILogger<OpenAiSkillSuggestionService> logger)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
        _openAi = openAi;
        _cache = cache;
        _logger = logger;
    }

    public async Task<AiSkillSuggestionStatusDto> GetStatusAsync(CancellationToken ct = default) => new()
    {
        Configured = await _openAi.IsConfiguredAsync(ct),
        Enabled = await _openAi.IsEnabledAsync(ct),
    };

    public async Task<AiSkillSuggestionResultDto> SuggestSkillsAsync(
        AiSkillSuggestionRequestDto request,
        CancellationToken ct = default)
    {
        if (!await _openAi.IsEnabledAsync(ct))
            throw new InvalidOperationException(
                "AI skill suggestions are not enabled. Add an OpenAI API key under Policy & Settings, or set OpenAI:ApiKey / OPENAI_API_KEY.");

        var title = request.Title?.Trim() ?? "";
        if (title.Length == 0)
            throw new InvalidOperationException("Enter a requisition title before requesting AI skill suggestions.");

        var cacheKey = BuildCacheKey(title, request.JobTitleId, request.DepartmentId);
        if (_cache.TryGetValue(cacheKey, out List<string>? cached) && cached is { Count: > 0 })
        {
            return new AiSkillSuggestionResultDto
            {
                Skills = cached,
                FromCache = true,
                Source = "ai",
            };
        }

        var context = await BuildContextAsync(title, request.JobTitleId, request.DepartmentId, ct);
        var skills = await CallOpenAiAsync(context, ct);

        if (skills.Count == 0)
            throw new InvalidOperationException("AI did not return any skills. Try again or add skills manually.");

        _cache.Set(cacheKey, skills, CacheTtl);

        return new AiSkillSuggestionResultDto
        {
            Skills = skills,
            FromCache = false,
            Source = "ai",
        };
    }

    private async Task<string> BuildContextAsync(string title, Guid? jobTitleId, Guid? departmentId, CancellationToken ct)
    {
        var lines = new List<string> { $"Requisition title: {title}" };

        if (jobTitleId.HasValue)
        {
            var jobTitle = await _db.JobTitles.AsNoTracking()
                .Where(j => j.Id == jobTitleId.Value)
                .Select(j => j.Title)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(jobTitle))
                lines.Add($"Job catalog title: {jobTitle}");
        }

        if (departmentId.HasValue)
        {
            var dept = await _db.Departments.AsNoTracking()
                .Where(d => d.Id == departmentId.Value)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(dept))
                lines.Add($"Department: {dept}");
        }

        return string.Join("\n", lines);
    }

    private async Task<List<string>> CallOpenAiAsync(string roleContext, CancellationToken ct)
    {
        var apiKey = (await _openAi.GetApiKeyAsync(ct))!;
        var model = await _openAi.GetModelAsync(ct);

        var systemPrompt =
            """
            You are an HR assistant for OpenSky HRM. Given a job requisition, suggest 8–12 concise skill names suitable for a job posting and applicant screening.
            Use short, practical phrases (e.g. "Food safety (HACCP)", "MIG / TIG welding", "Valid driving licence").
            Do not include proficiency levels, years of experience, or full sentences.
            Return ONLY valid JSON in this exact shape: {"skills":["Skill one","Skill two"]}
            """;

        var userPrompt = $"""
            Suggest skills for this role:

            {roleContext}
            """;

        var payload = new
        {
            model,
            temperature = 0.4,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userPrompt },
            },
        };

        var client = _httpClientFactory.CreateClient(nameof(OpenAiSkillSuggestionService));
        client.Timeout = TimeSpan.FromSeconds(45);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        using var httpContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await client.PostAsync("https://api.openai.com/v1/chat/completions", httpContent, ct);
        var body = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("OpenAI skill suggestion failed ({Status}): {Body}", (int)response.StatusCode, Truncate(body, 500));
            throw new InvalidOperationException(FormatOpenAiError(response.StatusCode, body));
        }

        return ParseSkillsFromOpenAiResponse(body);
    }

    private static string FormatOpenAiError(System.Net.HttpStatusCode status, string body)
    {
        var openAiMessage = TryParseOpenAiErrorMessage(body);

        if (status == System.Net.HttpStatusCode.Unauthorized)
            return "OpenAI API key is invalid. Check the key in Policy & Settings → Recruitment — OpenAI.";

        if (status == System.Net.HttpStatusCode.TooManyRequests)
        {
            if (openAiMessage?.Contains("quota", StringComparison.OrdinalIgnoreCase) == true)
                return "OpenAI quota exceeded. Add billing or credits at platform.openai.com, or add skills manually / use role templates.";
            return openAiMessage ?? "OpenAI rate limit reached. Wait a moment and try again.";
        }

        if (!string.IsNullOrWhiteSpace(openAiMessage))
            return $"OpenAI: {openAiMessage}";

        return "AI skill suggestion failed. Try again later or add skills manually.";
    }

    private static string? TryParseOpenAiErrorMessage(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("error", out var err)
                && err.TryGetProperty("message", out var msg)
                && msg.ValueKind == JsonValueKind.String)
            {
                return msg.GetString()?.Trim();
            }
        }
        catch
        {
            /* ignore parse errors */
        }

        return null;
    }

    private static List<string> ParseSkillsFromOpenAiResponse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var content = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(content))
            return [];

        using var skillsDoc = JsonDocument.Parse(content);
        if (!skillsDoc.RootElement.TryGetProperty("skills", out var skillsEl) || skillsEl.ValueKind != JsonValueKind.Array)
            return [];

        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in skillsEl.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.String) continue;
            var skill = item.GetString()?.Trim() ?? "";
            if (skill.Length == 0 || !seen.Add(skill)) continue;
            result.Add(skill);
        }

        return result;
    }

    private static string BuildCacheKey(string title, Guid? jobTitleId, Guid? departmentId)
    {
        var normalized = Regex.Replace(title.ToLowerInvariant(), @"\s+", " ").Trim();
        return $"ai-skills:{normalized}:{jobTitleId}:{departmentId}";
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "…";
}
