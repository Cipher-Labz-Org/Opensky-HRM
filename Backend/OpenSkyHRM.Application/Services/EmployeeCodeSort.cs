using System.Globalization;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Sorts employee codes numerically when possible (988 before 1127), otherwise alphabetically.
/// </summary>
internal static class EmployeeCodeSort
{
    public static long NumericKey(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return long.MaxValue;

        var trimmed = code.Trim();
        if (long.TryParse(trimmed, NumberStyles.Integer, CultureInfo.InvariantCulture, out var whole))
            return whole;

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        return long.TryParse(digits, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : long.MaxValue;
    }

    public static int Compare(string? left, string? right)
    {
        var byNumber = NumericKey(left).CompareTo(NumericKey(right));
        if (byNumber != 0)
            return byNumber;

        return string.Compare(left?.Trim(), right?.Trim(), StringComparison.OrdinalIgnoreCase);
    }
}
