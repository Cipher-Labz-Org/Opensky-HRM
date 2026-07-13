using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Common;

public static class InputValidators
{
    private static readonly Regex PersonNameRegex = new(@"^[A-Za-z\s'\-]+$", RegexOptions.Compiled);
    private static readonly Regex PhoneIntlRegex = new(@"^\+[1-9]\d{7,14}$", RegexOptions.Compiled);
    private static readonly Regex PhoneLocalRegex = new(@"^\d{8,15}$", RegexOptions.Compiled);
    private static readonly Regex NicRegex = new(@"^(\d{9}[VvXx]|\d{12})$", RegexOptions.Compiled);
    private static readonly Regex DrivingLicenseRegex = new(@"^[A-Za-z0-9\s\-/]+$", RegexOptions.Compiled);
    private static readonly Regex PassportNumberRegex = new(@"^[A-Za-z0-9\-\s]+$", RegexOptions.Compiled);
    private static readonly Regex UsernameRegex = new(@"^[A-Za-z0-9@.]+$", RegexOptions.Compiled);
    private static readonly Regex TinRegex = new(@"^[A-Za-z0-9]+$", RegexOptions.Compiled);
    private static readonly Regex StatutoryFundNumberRegex =
        new(@"^[A-Z]{2}/[A-Z]{3}/\d{7}/[A-Z0-9]{3}/\d{7}$", RegexOptions.Compiled);

    public const string PhoneValidationMessage =
        "Phone must be 8–15 digits. Examples: +94112876663 or 0762535363.";

    public const string NicValidationMessage =
        "Enter a valid NIC (9 digits + V/X or 12 digits).";

    public const string DrivingLicenseValidationMessage =
        "Can only contain letters, numbers, spaces, hyphens, and slashes.";

    public const string PassportNumberValidationMessage =
        "Can only contain letters, numbers, hyphens, and spaces.";

    public const string UsernameValidationMessage =
        "Username can only contain letters, numbers, @ and .";

    public const string EmailInputValidationMessage =
        "Email can only contain letters, numbers, @ and .";

    private static readonly Regex EmailInputRegex = new(@"^[A-Za-z0-9@.]+$", RegexOptions.Compiled);

    public const string TinValidationMessage =
        "TIN may only contain letters (A–Z) and numbers (0–9).";

    public const string EpfValidationMessage =
        "Enter a valid EPF number (e.g. MH/BAN/0000064/000/0000123).";

    public const string EtfValidationMessage =
        "Enter a valid ETF number (e.g. MH/BAN/0000064/000/0000123).";

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

    public static bool IsValidPassportNumber(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return PassportNumberRegex.IsMatch(value.Trim());
    }

    public static void ValidatePassportNumber(string? value, string fieldName, bool required = false)
    {
        if (IsValidPassportNumber(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {PassportNumberValidationMessage}");
    }

    public static bool IsValidUsername(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return UsernameRegex.IsMatch(value.Trim());
    }

    public static void ValidateUsername(string? value, string fieldName, bool required = true)
    {
        if (IsValidUsername(value, required)) return;
        throw new InvalidOperationException(
            required && string.IsNullOrWhiteSpace(value)
                ? $"{fieldName} is required."
                : $"{fieldName}: {UsernameValidationMessage}");
    }

    public static bool IsValidEmailInput(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return EmailInputRegex.IsMatch(value.Trim());
    }

    public static void ValidateEmailInput(string? value, string fieldName, bool required = false)
    {
        if (IsValidEmailInput(value, required)) return;
        throw new InvalidOperationException(
            required && string.IsNullOrWhiteSpace(value)
                ? $"{fieldName} is required."
                : $"{fieldName}: {EmailInputValidationMessage}");
    }

    public static string? NormalizeTin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var compact = new string(value.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        if (compact.Length == 0) return null;
        return compact.Length > 50 ? compact[..50] : compact;
    }

    public static bool IsValidTin(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        var normalized = NormalizeTin(value.Trim()) ?? "";
        return normalized.Length > 0 && TinRegex.IsMatch(normalized);
    }

    public static string? NormalizeStatutoryFundNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var compact = new string(value.ToUpperInvariant().Where(c => char.IsLetterOrDigit(c)).ToArray());
        if (compact.Length == 0) return null;

        var pos = 0;
        string TakeLetters(int count)
        {
            var outChars = new List<char>();
            while (outChars.Count < count && pos < compact.Length)
            {
                var ch = compact[pos];
                if (char.IsLetter(ch))
                {
                    outChars.Add(ch);
                    pos++;
                }
                else break;
            }
            return new string(outChars.ToArray());
        }

        string TakeDigits(int count)
        {
            var outChars = new List<char>();
            while (outChars.Count < count && pos < compact.Length)
            {
                var ch = compact[pos];
                if (char.IsDigit(ch))
                {
                    outChars.Add(ch);
                    pos++;
                }
                else break;
            }
            return new string(outChars.ToArray());
        }

        string TakeExtension(int count)
        {
            var outChars = new List<char>();
            while (outChars.Count < count && pos < compact.Length)
            {
                var ch = compact[pos];
                if (char.IsLetterOrDigit(ch))
                {
                    outChars.Add(ch);
                    pos++;
                }
                else break;
            }
            return new string(outChars.ToArray());
        }

        var parts = new List<string>();
        void Add(string segment)
        {
            if (!string.IsNullOrEmpty(segment)) parts.Add(segment);
        }

        Add(TakeLetters(2));
        Add(TakeLetters(3));
        Add(TakeDigits(7));
        Add(TakeExtension(3));
        Add(TakeDigits(7));
        return string.Join('/', parts);
    }

    public static bool IsValidStatutoryFundNumber(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        var normalized = NormalizeStatutoryFundNumber(value.Trim()) ?? "";
        return StatutoryFundNumberRegex.IsMatch(normalized);
    }

    public static void ValidateTin(string? value, string fieldName, bool required = false)
    {
        if (IsValidTin(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {TinValidationMessage}");
    }

    public static void ValidateEpfNumber(string? value, string fieldName, bool required = false)
    {
        if (IsValidStatutoryFundNumber(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {EpfValidationMessage}");
    }

    public static void ValidateEtfNumber(string? value, string fieldName, bool required = false)
    {
        if (IsValidStatutoryFundNumber(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {EtfValidationMessage}");
    }

    public static bool StatutoryFundNumbersEqual(string? a, string? b)
    {
        if (string.IsNullOrWhiteSpace(a) && string.IsNullOrWhiteSpace(b)) return true;
        return string.Equals(a?.Trim(), b?.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static readonly Regex AddressTextRegex =
        new(@"^[\p{L}\p{N}\s.,'\-:&/#()\[\]\\@]+$", RegexOptions.Compiled);
    private static readonly Regex PostalCodeRegex =
        new(@"^[\p{L}\p{N}\s.,'\-:&/#()\[\]\\@]+$", RegexOptions.Compiled);
    private static readonly Regex DistanceKmRegex =
        new(@"^\d+(\.\d+)?$", RegexOptions.Compiled);

    public const string AddressTextValidationMessage =
        "Can only contain letters, numbers, spaces, and . , - ' : & / # ( ) [ ] \\ @.";

    public const string PostalCodeValidationMessage =
        "Can only contain letters, numbers, spaces, and . , - ' : & / # ( ) [ ] \\ @.";

    public const string DistanceKmValidationMessage =
        "Enter a valid distance in KM (e.g. 15 or 12.5).";

    public static bool IsValidAddressText(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return AddressTextRegex.IsMatch(value.Trim());
    }

    public static bool IsValidPostalCode(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return PostalCodeRegex.IsMatch(value.Trim());
    }

    public static bool IsValidDistanceKm(string? value, bool required = false)
    {
        if (string.IsNullOrWhiteSpace(value)) return !required;
        return DistanceKmRegex.IsMatch(value.Trim());
    }

    public static void ValidateAddressText(string? value, string fieldName, bool required = false)
    {
        if (IsValidAddressText(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {AddressTextValidationMessage}");
    }

    public static void ValidatePostalCode(string? value, string fieldName, bool required = false)
    {
        if (IsValidPostalCode(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {PostalCodeValidationMessage}");
    }

    public static void ValidateDistanceKm(string? value, string fieldName, bool required = false)
    {
        if (IsValidDistanceKm(value, required)) return;
        throw new InvalidOperationException($"{fieldName}: {DistanceKmValidationMessage}");
    }

    public static void ValidateEmployeeAddressFields(
        string? addressStreet1,
        string? addressStreet2,
        string? city,
        string? zipPostalCode,
        string? pollingDivision,
        string? distanceToOffice,
        string? permanentStreet1,
        string? permanentStreet2,
        string? permanentCity,
        string? permanentZipPostalCode,
        string? permanentPollingDivision,
        string? permanentDistanceToOffice)
    {
        ValidateAddressText(addressStreet1, "Address Street 1", required: false);
        ValidateAddressText(addressStreet2, "Address Street 2", required: false);
        ValidateAddressText(city, "City", required: false);
        ValidateAddressText(pollingDivision, "Polling Division", required: false);
        ValidatePostalCode(zipPostalCode, "Zip/Postal Code", required: false);
        ValidateDistanceKm(distanceToOffice, "Distance to Office (KM)", required: false);
        ValidateAddressText(permanentStreet1, "Permanent Address Street 1", required: false);
        ValidateAddressText(permanentStreet2, "Permanent Address Street 2", required: false);
        ValidateAddressText(permanentCity, "Permanent City", required: false);
        ValidateAddressText(permanentPollingDivision, "Permanent Polling Division", required: false);
        ValidatePostalCode(permanentZipPostalCode, "Permanent Zip/Postal Code", required: false);
        ValidateDistanceKm(permanentDistanceToOffice, "Permanent Distance to Office (KM)", required: false);
    }

    public static void ValidateEmployeeImportAddressFields(
        List<string> errors,
        string? addressStreet1,
        string? addressStreet2,
        string? city,
        string? zipPostalCode,
        string? pollingDivision,
        string? distanceToOffice,
        string? permanentStreet1,
        string? permanentStreet2,
        string? permanentCity,
        string? permanentZipPostalCode,
        string? permanentPollingDivision,
        string? permanentDistanceToOffice)
    {
        AddAddressValidationError(errors, addressStreet1, IsValidAddressText, "Address Street 1", AddressTextValidationMessage);
        AddAddressValidationError(errors, addressStreet2, IsValidAddressText, "Address Street 2", AddressTextValidationMessage);
        AddAddressValidationError(errors, city, IsValidAddressText, "City", AddressTextValidationMessage);
        AddAddressValidationError(errors, pollingDivision, IsValidAddressText, "Polling Division", AddressTextValidationMessage);
        AddAddressValidationError(errors, zipPostalCode, IsValidPostalCode, "Zip/Postal Code", PostalCodeValidationMessage);
        AddAddressValidationError(errors, distanceToOffice, IsValidDistanceKm, "Distance to Office", DistanceKmValidationMessage);
        AddAddressValidationError(errors, permanentStreet1, IsValidAddressText, "Permanent Street 1", AddressTextValidationMessage);
        AddAddressValidationError(errors, permanentStreet2, IsValidAddressText, "Permanent Street 2", AddressTextValidationMessage);
        AddAddressValidationError(errors, permanentCity, IsValidAddressText, "Permanent City", AddressTextValidationMessage);
        AddAddressValidationError(errors, permanentPollingDivision, IsValidAddressText, "Permanent Polling Division", AddressTextValidationMessage);
        AddAddressValidationError(errors, permanentZipPostalCode, IsValidPostalCode, "Permanent Zip/Postal Code", PostalCodeValidationMessage);
        AddAddressValidationError(errors, permanentDistanceToOffice, IsValidDistanceKm, "Permanent Distance to Office", DistanceKmValidationMessage);
    }

    private static void AddAddressValidationError(
        List<string> errors,
        string? value,
        Func<string?, bool, bool> validator,
        string fieldLabel,
        string message)
    {
        if (validator(value, false)) return;
        if (string.IsNullOrWhiteSpace(value)) return;
        errors.Add($"{fieldLabel}: {message}");
    }
}
