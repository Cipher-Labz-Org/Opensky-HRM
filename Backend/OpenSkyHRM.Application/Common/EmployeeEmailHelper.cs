namespace OpenSkyHRM.Application.Common;

public static class EmployeeEmailHelper
{
    public const string PlaceholderDomain = "@employee.noemail.opensky.hrm";

    public static bool IsPlaceholder(string? email) =>
        !string.IsNullOrWhiteSpace(email)
        && email.Trim().Contains(PlaceholderDomain, StringComparison.OrdinalIgnoreCase);

    public static string? ToDisplayEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || IsPlaceholder(email)) return null;
        return email.Trim();
    }

    public static string? NormalizeForSave(string? email)
    {
        var trimmed = email?.Trim();
        if (string.IsNullOrEmpty(trimmed) || IsPlaceholder(trimmed)) return null;
        return trimmed;
    }
}
