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
    private readonly OpenAiSettingsResolver _openAi;
    private readonly IOpenAiChatClient _chatClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<OpenAiSkillSuggestionService> _logger;

    public OpenAiSkillSuggestionService(
        AppDbContext db,
        OpenAiSettingsResolver openAi,
        IOpenAiChatClient chatClient,
        IMemoryCache cache,
        ILogger<OpenAiSkillSuggestionService> logger)
    {
        _db = db;
        _openAi = openAi;
        _chatClient = chatClient;
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

        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt },
            new { role = "user", content = userPrompt },
        };

        try
        {
            var content = await _chatClient.GetCompletionContentAsync(
                messages,
                temperature: 0.4,
                responseFormat: new { type = "json_object" },
                ct: ct);
            return ParseSkillsFromContent(content);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("OpenAI skill suggestion failed: {Message}", ex.Message);
            throw;
        }
    }

    private static List<string> ParseSkillsFromContent(string content)
    {
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
}
