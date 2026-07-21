using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class RequisitionSkillSuggestionService : IRequisitionSkillSuggestionService
{
    private static readonly string[] DefaultSkills =
    [
        "Communication",
        "Problem solving",
        "Collaboration",
        "Time management",
        "Microsoft 365 / Google Workspace",
        "Documentation",
        "Stakeholder management",
        "Attention to detail",
    ];

    private readonly AppDbContext _db;

    public RequisitionSkillSuggestionService(AppDbContext db) => _db = db;

    public async Task<SkillSuggestionsDto> GetSuggestionsAsync(string? title, Guid? jobTitleId, CancellationToken ct = default)
    {
        var catalog = await _db.Skills.AsNoTracking()
            .Where(s => s.IsActive)
            .OrderBy(s => s.Name)
            .Select(s => s.Name)
            .ToListAsync(ct);

        var matchText = await BuildMatchTextAsync(title, jobTitleId, ct);
        var normalized = Normalize(matchText);

        var sources = new List<string>();
        var suggested = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        void AddSkills(IEnumerable<string> skills, string source)
        {
            var added = false;
            foreach (var skill in skills)
            {
                var trimmed = skill.Trim();
                if (trimmed.Length == 0 || !seen.Add(trimmed)) continue;
                suggested.Add(trimmed);
                added = true;
            }
            if (added && !sources.Contains(source))
                sources.Add(source);
        }

        var templates = await _db.RequisitionSkillTemplates.AsNoTracking()
            .Include(t => t.JobTitle)
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);

        foreach (var template in templates)
        {
            if (!TemplateMatches(template, normalized, jobTitleId))
                continue;
            AddSkills(ParseDelimited(template.Skills, ','), "template");
        }

        if (!string.IsNullOrWhiteSpace(title))
        {
            var historical = await GetHistoricalSkillsAsync(title.Trim(), ct);
            AddSkills(historical, "history");
        }

        if (suggested.Count == 0)
            AddSkills(DefaultSkills, "default");

        return new SkillSuggestionsDto
        {
            Suggested = suggested,
            Source = sources.Count switch
            {
                0 => "default",
                1 => sources[0],
                _ => "mixed",
            },
            Catalog = catalog,
        };
    }

    public async Task<List<RequisitionSkillTemplateDto>> GetTemplatesAsync(CancellationToken ct = default)
    {
        var items = await _db.RequisitionSkillTemplates.AsNoTracking()
            .Include(t => t.JobTitle)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);
        return items.Select(MapTemplate).ToList();
    }

    public async Task<RequisitionSkillTemplateDto> CreateTemplateAsync(UpsertRequisitionSkillTemplateDto dto, CancellationToken ct = default)
    {
        ValidateTemplate(dto);
        var entity = new RequisitionSkillTemplate
        {
            Name = dto.Name.Trim(),
            Keywords = dto.Keywords.Trim(),
            Skills = dto.Skills.Trim(),
            JobTitleId = dto.JobTitleId,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
        };
        _db.RequisitionSkillTemplates.Add(entity);
        await _db.SaveChangesAsync(ct);
        await _db.Entry(entity).Reference(t => t.JobTitle).LoadAsync(ct);
        return MapTemplate(entity);
    }

    public async Task<RequisitionSkillTemplateDto?> UpdateTemplateAsync(Guid id, UpsertRequisitionSkillTemplateDto dto, CancellationToken ct = default)
    {
        ValidateTemplate(dto);
        var entity = await _db.RequisitionSkillTemplates
            .Include(t => t.JobTitle)
            .FirstOrDefaultAsync(t => t.Id == id, ct);
        if (entity is null) return null;

        entity.Name = dto.Name.Trim();
        entity.Keywords = dto.Keywords.Trim();
        entity.Skills = dto.Skills.Trim();
        entity.JobTitleId = dto.JobTitleId;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync(ct);
        return MapTemplate(entity);
    }

    public async Task<bool> DeleteTemplateAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.RequisitionSkillTemplates.FindAsync([id], ct);
        if (entity is null) return false;
        _db.RequisitionSkillTemplates.Remove(entity);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<string> BuildMatchTextAsync(string? title, Guid? jobTitleId, CancellationToken ct)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(title))
            parts.Add(title.Trim());

        if (jobTitleId.HasValue)
        {
            var jobTitle = await _db.JobTitles.AsNoTracking()
                .Where(j => j.Id == jobTitleId.Value)
                .Select(j => j.Title)
                .FirstOrDefaultAsync(ct);
            if (!string.IsNullOrWhiteSpace(jobTitle))
                parts.Add(jobTitle);
        }

        return string.Join(' ', parts);
    }

    private static bool TemplateMatches(RequisitionSkillTemplate template, string normalizedText, Guid? jobTitleId)
    {
        if (template.JobTitleId.HasValue && jobTitleId.HasValue && template.JobTitleId == jobTitleId)
            return true;

        if (string.IsNullOrWhiteSpace(normalizedText))
            return false;

        foreach (var keyword in ParseDelimited(template.Keywords, '|'))
        {
            var k = Normalize(keyword);
            if (k.Length >= 2 && normalizedText.Contains(k, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private async Task<List<string>> GetHistoricalSkillsAsync(string title, CancellationToken ct)
    {
        var words = Regex.Split(title.ToLowerInvariant(), @"[^a-z0-9]+")
            .Where(w => w.Length >= 3)
            .Distinct()
            .OrderByDescending(w => w.Length)
            .Take(3)
            .ToList();

        if (words.Count == 0)
            return [];

        var primary = words[0];
        var skillRows = await _db.Requisitions.AsNoTracking()
            .Where(r => r.Skills != null && r.Skills != "" && r.Title != null)
            .Where(r => EF.Functions.ILike(r.Title!, $"%{primary}%"))
            .OrderByDescending(r => r.CreatedAt)
            .Take(25)
            .Select(r => r.Skills!)
            .ToListAsync(ct);

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var csv in skillRows)
        {
            foreach (var skill in ParseDelimited(csv, ','))
            {
                if (skill.Length == 0) continue;
                counts[skill] = counts.GetValueOrDefault(skill) + 1;
            }
        }

        return counts
            .OrderByDescending(kv => kv.Value)
            .ThenBy(kv => kv.Key, StringComparer.OrdinalIgnoreCase)
            .Select(kv => kv.Key)
            .Take(12)
            .ToList();
    }

    private static void ValidateTemplate(UpsertRequisitionSkillTemplateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new InvalidOperationException("Template name is required.");
        if (string.IsNullOrWhiteSpace(dto.Keywords))
            throw new InvalidOperationException("At least one keyword is required (pipe-separated).");
        if (string.IsNullOrWhiteSpace(dto.Skills))
            throw new InvalidOperationException("At least one skill is required (comma-separated).");
    }

    private static IEnumerable<string> ParseDelimited(string? value, char separator) =>
        (value ?? "")
            .Split(separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => s.Trim())
            .Where(s => s.Length > 0);

    private static string Normalize(string value) =>
        Regex.Replace(
            Regex.Replace(value.ToLowerInvariant(), @"[^a-z0-9\s.-]+", " "),
            @"\s+",
            " ").Trim();

    private static RequisitionSkillTemplateDto MapTemplate(RequisitionSkillTemplate t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        Keywords = t.Keywords,
        Skills = t.Skills,
        Code = t.Keywords,
        Description = t.Skills,
        JobTitleId = t.JobTitleId,
        JobTitleName = t.JobTitle?.Title,
        SortOrder = t.SortOrder,
        IsActive = t.IsActive,
    };
}
