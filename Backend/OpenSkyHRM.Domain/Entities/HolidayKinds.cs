namespace OpenSkyHRM.Domain.Entities;

public static class HolidayKinds
{
    public const string Public = "Public";
    public const string Mercantile = "Mercantile";
    public const string Poya = "Poya";
    public const string Restricted = "Restricted";

    public static string Normalize(string? kind, bool isRestricted = false)
    {
        if (string.Equals(kind, Mercantile, StringComparison.OrdinalIgnoreCase)) return Mercantile;
        if (string.Equals(kind, Poya, StringComparison.OrdinalIgnoreCase)) return Poya;
        if (string.Equals(kind, Restricted, StringComparison.OrdinalIgnoreCase)) return Restricted;
        if (string.Equals(kind, Public, StringComparison.OrdinalIgnoreCase)) return Public;
        return isRestricted ? Restricted : Public;
    }
}
