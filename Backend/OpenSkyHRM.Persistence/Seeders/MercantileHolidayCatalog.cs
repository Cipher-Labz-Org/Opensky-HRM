namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Statutory mercantile holidays under the Shop &amp; Office Employees Act (Sri Lanka).
/// Dates follow the annual mercantile schedule (2024–2027).
/// </summary>
public static class MercantileHolidayCatalog
{
    private sealed record Entry(string Name, int Month, int Day);

    private static readonly Dictionary<int, Entry[]> ByYear = new()
    {
        [2024] =
        [
            new("Tamil Thai Pongal Day", 1, 15),
            new("Independence Day", 2, 4),
            new("Day Prior to Sinhala and Tamil New Year Day", 4, 12),
            new("Sinhala and Tamil New Year Day", 4, 13),
            new("May Day", 5, 1),
            new("Day Following Vesak Full Moon Poya Day", 5, 24),
            new("Milad-Un-Nabi (Holy Prophet's Birthday)", 9, 16),
            new("Christmas Day", 12, 25),
        ],
        [2025] =
        [
            new("Tamil Thai Pongal Day", 1, 14),
            new("Independence Day", 2, 4),
            new("Day Prior to Sinhala and Tamil New Year Day", 4, 13),
            new("Sinhala and Tamil New Year Day", 4, 14),
            new("May Day", 5, 1),
            new("Day Following Vesak Full Moon Poya Day", 5, 14),
            new("Milad-Un-Nabi (Holy Prophet's Birthday)", 9, 5),
            new("Christmas Day", 12, 25),
        ],
        [2026] =
        [
            new("Tamil Thai Pongal Day", 1, 15),
            new("Independence Day", 2, 4),
            new("Day Prior to Sinhala and Tamil New Year Day", 4, 13),
            new("Sinhala and Tamil New Year Day", 4, 14),
            new("May Day", 5, 1),
            new("Day Following Vesak Full Moon Poya Day", 5, 31),
            new("Milad-Un-Nabi (Holy Prophet's Birthday)", 8, 26),
            new("Christmas Day", 12, 25),
        ],
        [2027] =
        [
            new("Tamil Thai Pongal Day", 1, 14),
            new("Independence Day", 2, 4),
            new("Day Prior to Sinhala and Tamil New Year Day", 4, 13),
            new("Sinhala and Tamil New Year Day", 4, 14),
            new("May Day", 5, 1),
            new("Day Following Vesak Full Moon Poya Day", 5, 21),
            new("Milad-Un-Nabi (Holy Prophet's Birthday)", 8, 16),
            new("Christmas Day", 12, 25),
        ],
    };

    public static IReadOnlyList<(string Name, DateTime Date)> ForYear(int year)
    {
        if (!ByYear.TryGetValue(year, out var entries))
            return Array.Empty<(string, DateTime)>();

        return entries
            .Select(e => (e.Name, new DateTime(year, e.Month, e.Day, 0, 0, 0, DateTimeKind.Utc)))
            .ToList();
    }

    public static IEnumerable<int> SupportedYears => ByYear.Keys;
}
