namespace OpenSkyHRM.Application.Common;

public static class UserUniqueness
{
    /// <summary>Rewrites username on soft-delete so unique indexes can accept a new account with the same name.</summary>
    public static string ArchiveUsername(Guid userId, string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            var fallback = $"archived-{userId:N}";
            return fallback.Length <= 100 ? fallback : fallback[..100];
        }

        const string marker = ".archived.";
        if (username.Contains(marker, StringComparison.OrdinalIgnoreCase))
            return username;

        var suffix = $"{marker}{userId:N}";
        var maxLen = 100 - suffix.Length;
        if (maxLen < 1)
        {
            var compact = $"u{userId:N}";
            return compact.Length <= 100 ? compact : compact[..100];
        }

        var trimmed = username.Length > maxLen ? username[..maxLen] : username;
        return $"{trimmed}{suffix}";
    }

    /// <summary>Rewrites email on soft-delete; user rows require a non-null email.</summary>
    public static string ArchiveEmail(Guid userId, string email)
    {
        var archived = EmployeeUniqueness.ArchiveEmail(userId, email);
        if (!string.IsNullOrWhiteSpace(archived))
            return archived;

        var fallback = $"archived-{userId:N}@noemail.opensky.hrm";
        return fallback.Length <= 255 ? fallback : fallback[..255];
    }
}
