using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Common;

public static class InputValidators
{
    private static readonly Regex PersonNameRegex = new(@"^[A-Za-z\s'\-]+$", RegexOptions.Compiled);
    private static readonly Regex PhoneIntlRegex = new(@"^\+[1-9]\d{7,14}$", RegexOptions.Compiled);
    private static readonly Regex PhoneLocalRegex = new(@"^\d{8,15}$", RegexOptions.Compiled);
    private static readonly Regex NicRegex = new(@"^(\d{9}[VvXx]|\d{12})$", RegexOptions.Compiled);
    private static readonly Regex DrivingLicenseRegex = new(@"^[A-Za-z0-9]+$", RegexOptions.Compiled);

    public const string PhoneValidationMessage =
        "Phone must be 8–15 digits. Examples: +94112876663 or 0762535363.";

    public const string NicValidationMessage =
        "Enter a valid NIC (9 digits + V/X or 12 digits).";

    public const string DrivingLicenseValidationMessage =
        "Can only contain letters and numbers.";

    public static bool IsValidPersonName(string? value, bool required = true)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return PersonNameRegex.IsMatch(value.Trim());
    }

    public static bool IsValidPhone(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        var trimmed = value.Trim();
        return trimmed.StartsWith('+') ? PhoneIntlRegex.IsMatch(trimmed) : PhoneLocalRegex.IsMatch(trimmed);
    }

    public static void ValidatePersonName(string? value, string fieldName, bool required = true)
    {
        if (IsValidPersonName(value, required)) return;
        throw new InvalidOperationException(
            required
                ? $"{fieldName} is required and may only contain letters, spaces, hyphens, and apostrophes."
                : $"{fieldName} may only contain letters, spaces, hyphens, and apostrophes.");
    }

    public static void ValidatePhone(string? value, string fieldName, bool required = false)
    {
        if (IsValidPhone(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {PhoneValidationMessage}");
    }

    public static bool IsValidNic(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return NicRegex.IsMatch(value.Trim());
    }

    public static bool IsValidDrivingLicense(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return DrivingLicenseRegex.IsMatch(value.Trim());
    }

    public static void ValidateNic(string? value, string fieldName, bool required = false)
    {
        if (IsValidNic(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {NicValidationMessage}");
    }

    public static void ValidateDrivingLicense(string? value, string fieldName, bool required = false)
    {
        if (IsValidDrivingLicense(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {DrivingLicenseValidationMessage}");
    }
}
