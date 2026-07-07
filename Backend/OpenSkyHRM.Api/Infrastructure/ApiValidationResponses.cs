using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Text.RegularExpressions;

namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>Maps ASP.NET model-state keys/messages to user-facing validation text.</summary>
public static class ApiValidationResponses
{
    private static readonly HashSet<string> SkipFieldKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "dto", "req", "request", "body", "$",
    };

    private static readonly Dictionary<string, string> FieldLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["employee"] = "Employee details",
        ["employeecode"] = "Employee code",
        ["firstname"] = "First name",
        ["lastname"] = "Last name",
        ["middlename"] = "Middle name",
        ["email"] = "Email",
        ["phone"] = "Phone",
        ["dateofbirth"] = "Date of birth",
        ["joindate"] = "Join date",
        ["gender"] = "Gender",
        ["departmentid"] = "Department",
        ["jobtitleid"] = "Job title",
        ["locationid"] = "Location",
        ["businessunitid"] = "Business unit",
        ["gradeid"] = "Grade",
        ["positionid"] = "Position",
        ["managerid"] = "Manager",
        ["username"] = "Username",
        ["password"] = "Password",
        ["title"] = "Title",
        ["code"] = "Code",
        ["vacancies"] = "Vacancies",
        ["status"] = "Status",
        ["description"] = "Description",
        ["nationalid"] = "National ID",
        ["licenseissuedate"] = "License issue date",
        ["licenseexpirydate"] = "License expiry date",
    };

    public static IActionResult CreateResponse(ActionContext context)
    {
        var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

        foreach (var (rawKey, state) in context.ModelState)
        {
            if (state?.Errors.Count == 0) continue;

            foreach (var error in state!.Errors)
            {
                var message = FriendlyMessage(rawKey, error.ErrorMessage);
                if (string.IsNullOrWhiteSpace(message)) continue;

                var bucket = "general";
                var fieldKey = NormalizeFieldKey(rawKey);
                if (fieldKey != null)
                    bucket = fieldKey;

                if (!errors.TryGetValue(bucket, out var list))
                {
                    list = new List<string>();
                    errors[bucket] = list;
                }

                if (!list.Contains(message, StringComparer.OrdinalIgnoreCase))
                    list.Add(message);
            }
        }

        if (errors.Count == 0)
        {
            return new BadRequestObjectResult(new
            {
                message = "Please complete all required fields and try again.",
            });
        }

        var payload = errors.ToDictionary(
            kvp => kvp.Key == "general" ? "" : LabelForField(kvp.Key),
            kvp => kvp.Value.ToArray());

        return new BadRequestObjectResult(new
        {
            message = BuildSummary(payload),
            errors = payload,
        });
    }

    private static string? NormalizeFieldKey(string raw)
    {
        var field = raw.Trim();
        if (string.IsNullOrEmpty(field)) return null;

        field = Regex.Replace(field, @"^\$\.?", "");
        field = Regex.Replace(field, @"^\$\['?([^'\]]+)'?\]$", "$1");

        var segments = field.Split('.', StringSplitOptions.RemoveEmptyEntries);
        field = segments.Length > 0 ? segments[^1] : field;

        if (SkipFieldKeys.Contains(field)) return null;
        return field;
    }

    private static string LabelForField(string field)
    {
        var key = field.Replace("_", "").Replace("-", "");
        if (FieldLabels.TryGetValue(key, out var label)) return label;

        if (key.EndsWith("id", StringComparison.OrdinalIgnoreCase) && key.Length > 2)
            key = key[..^2];

        return Regex.Replace(key, "([a-z])([A-Z])", "$1 $2").Trim();
    }

    private static string? FriendlyMessage(string rawKey, string? rawMessage)
    {
        var message = (rawMessage ?? "").Trim();
        if (string.IsNullOrEmpty(message))
            message = "This field is required.";

        message = Regex.Replace(message, @"\$\.([A-Za-z][\w.]*)", m =>
        {
            var path = m.Groups[1].Value;
            var leaf = path.Split('.').LastOrDefault() ?? path;
            return LabelForField(leaf);
        });

        var fieldKey = NormalizeFieldKey(rawKey);
        if (fieldKey == null)
        {
            if (message.Contains("required", StringComparison.OrdinalIgnoreCase))
                return null;
            return HumanizeGeneric(message);
        }

        var label = LabelForField(fieldKey);
        var lower = message.ToLowerInvariant();

        if (lower.Contains("required") || lower.Contains("must not be empty") || lower.Contains("field is required"))
            return $"{label} is required";

        if (lower.Contains("not a valid") || lower.Contains("could not be converted")
            || lower.Contains("invalid guid") || lower.Contains("format is not valid")
            || lower.Contains("must be selected or entered correctly"))
            return $"{label} must be selected or entered correctly";

        if (message.Contains(fieldKey, StringComparison.OrdinalIgnoreCase))
            return message.Replace(fieldKey, label, StringComparison.OrdinalIgnoreCase);

        return $"{label}: {HumanizeGeneric(message)}";
    }

    private static string HumanizeGeneric(string message)
    {
        return message
            .Replace("JSON", "data", StringComparison.OrdinalIgnoreCase)
            .Replace("Dto", "form", StringComparison.OrdinalIgnoreCase)
            .Trim();
    }

    private static string BuildSummary(Dictionary<string, string[]> payload)
    {
        var parts = payload.Values.SelectMany(v => v).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (parts.Count == 0)
            return "Please complete all required fields and try again.";
        if (parts.Count == 1)
            return parts[0];
        return $"Please fix the following: {string.Join("; ", parts)}.";
    }
}
