using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services;

public sealed class AiLlmPayloadSanitizer
{
    private static readonly HashSet<string> StripFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "email", "phone", "mobile", "address", "nationalid", "medicalcertificateurl",
        "salary", "totalgross", "totalnet", "totaldeductions", "totalemployercost",
        "finalrating", "finalcomments", "acknowledgementcomment",
    };

    private static readonly HashSet<string> NameFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "name", "employeename", "reviewername", "manager", "assignedto",
    };

    private readonly OpenAiSettingsResolver _settings;

    public AiLlmPayloadSanitizer(OpenAiSettingsResolver settings) => _settings = settings;

    public async Task<string> SanitizeSystemPromptAsync(string prompt, CancellationToken ct = default)
    {
        if (await _settings.GetAllowPersonalNamesInLlmAsync(ct))
            return prompt;

        // Remove "User: {name}" line — keep roles/scope only.
        var lines = prompt.Split('\n');
        var filtered = lines.Where(l => !l.TrimStart().StartsWith("User:", StringComparison.OrdinalIgnoreCase));
        return string.Join('\n', filtered);
    }

    public async Task<string> SanitizeToolPayloadAsync(string jsonOrText, CancellationToken ct = default)
    {
        if (await _settings.GetAllowPersonalNamesInLlmAsync(ct))
            return jsonOrText;

        if (string.IsNullOrWhiteSpace(jsonOrText))
            return jsonOrText;

        try
        {
            using var doc = JsonDocument.Parse(jsonOrText);
            var sanitized = SanitizeElement(doc.RootElement);
            return JsonSerializer.Serialize(sanitized);
        }
        catch
        {
            return jsonOrText;
        }
    }

    public async Task<string> SanitizeForStorageAsync(AiToolResult result, CancellationToken ct = default)
    {
        if (result.Success)
        {
            var sanitizedJson = await SanitizeToolPayloadAsync(result.Json, ct);
            return $"{result.Summary}\n{sanitizedJson}";
        }

        return result.Json;
    }

    public async Task<string> FormatForModelAsync(AiToolResult result, CancellationToken ct = default)
    {
        if (result.Success)
        {
            var sanitizedJson = await SanitizeToolPayloadAsync(result.Json, ct);
            return $"{result.Summary}\n{sanitizedJson}";
        }

        return result.Json;
    }

    private static object? SanitizeElement(JsonElement el) => el.ValueKind switch
    {
        JsonValueKind.Object => SanitizeObject(el),
        JsonValueKind.Array => el.EnumerateArray().Select(SanitizeElement).ToList(),
        JsonValueKind.String => el.GetString(),
        JsonValueKind.Number => el.TryGetInt64(out var l) ? l : el.GetDouble(),
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Null => null,
        _ => el.GetRawText(),
    };

    private static Dictionary<string, object?> SanitizeObject(JsonElement obj)
    {
        var result = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        string? employeeCode = null;

        foreach (var prop in obj.EnumerateObject())
        {
            if (string.Equals(prop.Name, "employeeCode", StringComparison.OrdinalIgnoreCase)
                && prop.Value.ValueKind == JsonValueKind.String)
            {
                employeeCode = prop.Value.GetString();
            }
        }

        foreach (var prop in obj.EnumerateObject())
        {
            if (StripFields.Contains(prop.Name))
                continue;

            if (NameFields.Contains(prop.Name))
            {
                result[prop.Name] = employeeCode != null
                    ? $"Employee #{employeeCode}"
                    : "Employee (redacted)";
                continue;
            }

            result[prop.Name] = SanitizeElement(prop.Value);
        }

        return result;
    }
}
