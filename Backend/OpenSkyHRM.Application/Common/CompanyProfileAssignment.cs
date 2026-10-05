using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Common;

public static class CompanyProfileAssignment
{
    public static async Task<string> ResolveForCreateAsync(AppDbContext db, string? requestedKey)
    {
        var multiCompany = await MultiCompanyFeature.IsActiveAsync(db);
        if (!multiCompany)
            return CompanyProfileKeys.Primary;

        var key = string.IsNullOrWhiteSpace(requestedKey)
            ? CompanyProfileKeys.Primary
            : requestedKey.Trim();

        var allowed = await GetAllowedKeysAsync(db);
        if (!allowed.Contains(key))
        {
            throw new InvalidOperationException("Select a valid company profile for this employee.");
        }

        return key;
    }

    public static async Task<HashSet<string>> GetAllowedKeysAsync(AppDbContext db)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal) { CompanyProfileKeys.Primary };

        var raw = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == "AdditionalCompanyProfiles")
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(raw))
            return keys;

        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return keys;

            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;
                if (item.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.String)
                {
                    var id = idEl.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(id)) keys.Add(id);
                }
                else if (item.TryGetProperty("Id", out var idEl2) && idEl2.ValueKind == JsonValueKind.String)
                {
                    var id = idEl2.GetString()?.Trim();
                    if (!string.IsNullOrEmpty(id)) keys.Add(id);
                }
            }
        }
        catch (JsonException)
        {
            /* ignore malformed settings */
        }

        return keys;
    }

    /// <summary>Maps company profile display names and keys (case-insensitive) for bulk import.</summary>
    public static async Task<Dictionary<string, string>> GetImportLabelToKeyMapAsync(AppDbContext db)
    {
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var allowed = await GetAllowedKeysAsync(db);
        foreach (var key in allowed)
            map[key] = key;

        var settings = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == "CompanyName" || s.Key == "AdditionalCompanyProfiles")
            .ToDictionaryAsync(s => s.Key, s => s.Value);

        settings.TryGetValue("CompanyName", out var primaryNameRaw);
        var primaryName = (primaryNameRaw ?? "").Trim();
        if (!string.IsNullOrEmpty(primaryName))
            map[primaryName] = CompanyProfileKeys.Primary;

        if (!settings.TryGetValue("AdditionalCompanyProfiles", out var additionalRaw)
            || string.IsNullOrWhiteSpace(additionalRaw))
            return map;

        try
        {
            using var doc = JsonDocument.Parse(additionalRaw);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return map;

            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object) continue;
                var id = ReadJsonString(item, "id", "Id");
                var name = ReadJsonString(item, "name", "Name");
                if (string.IsNullOrEmpty(id)) continue;
                if (!string.IsNullOrEmpty(name))
                    map[name] = id;
                map[id] = id;
            }
        }
        catch (JsonException)
        {
            /* ignore malformed settings */
        }

        return map;
    }

    public static async Task<List<string>> GetImportDisplayLabelsAsync(AppDbContext db)
    {
        var map = await GetImportLabelToKeyMapAsync(db);
        var labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var ordered = new List<string>();

        var settings = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == "CompanyName" || s.Key == "AdditionalCompanyProfiles")
            .ToDictionaryAsync(s => s.Key, s => s.Value);

        settings.TryGetValue("CompanyName", out var primaryNameRaw);
        var primaryName = (primaryNameRaw ?? "").Trim();
        if (!string.IsNullOrEmpty(primaryName) && labels.Add(primaryName))
            ordered.Add(primaryName);

        if (settings.TryGetValue("AdditionalCompanyProfiles", out var additionalRaw)
            && !string.IsNullOrWhiteSpace(additionalRaw))
        {
            try
            {
                using var doc = JsonDocument.Parse(additionalRaw);
                if (doc.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var index = 0;
                    foreach (var item in doc.RootElement.EnumerateArray())
                    {
                        index++;
                        if (item.ValueKind != JsonValueKind.Object) continue;
                        var name = ReadJsonString(item, "name", "Name");
                        var label = !string.IsNullOrEmpty(name) ? name : $"Company profile {index}";
                        if (labels.Add(label))
                            ordered.Add(label);
                    }
                }
            }
            catch (JsonException)
            {
                /* ignore */
            }
        }

        if (ordered.Count == 0 && map.ContainsKey(CompanyProfileKeys.Primary))
            ordered.Add("Primary company");

        return ordered;
    }

    private static string ReadJsonString(JsonElement item, params string[] propertyNames)
    {
        foreach (var name in propertyNames)
        {
            if (!item.TryGetProperty(name, out var el) || el.ValueKind != JsonValueKind.String)
                continue;
            var text = el.GetString()?.Trim();
            if (!string.IsNullOrEmpty(text))
                return text;
        }

        return "";
    }
}
