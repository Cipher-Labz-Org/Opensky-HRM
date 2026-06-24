namespace OpenSkyHRM.Domain.Entities;

public static class HolidayCountryCodes
{
    public const string LK = "LK";
    public const string US = "US";
    public const string GB = "GB";
    public const string IN = "IN";
    public const string AU = "AU";

    public static string Normalize(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return LK;
        var upper = code.Trim().ToUpperInvariant();
        return upper switch
        {
            US => US,
            GB => GB,
            IN => IN,
            AU => AU,
            _ => LK,
        };
    }
}
