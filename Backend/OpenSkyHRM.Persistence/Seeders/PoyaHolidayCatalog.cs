namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Full moon Poya days in Sri Lanka (annual gazette schedule, 2024–2027).
/// </summary>
public static class PoyaHolidayCatalog
{
    private sealed record Entry(string Name, int Month, int Day);

    private static readonly Dictionary<int, Entry[]> ByYear = new()
    {
        [2024] =
        [
            new("Duruthu Full Moon Poya Day", 1, 25),
            new("Navam Full Moon Poya Day", 2, 23),
            new("Madin Full Moon Poya Day", 3, 24),
            new("Bak Full Moon Poya Day", 4, 23),
            new("Vesak Full Moon Poya Day", 5, 23),
            new("Poson Full Moon Poya Day", 6, 21),
            new("Esala Full Moon Poya Day", 7, 20),
            new("Nikini Full Moon Poya Day", 8, 19),
            new("Binara Full Moon Poya Day", 9, 17),
            new("Vap Full Moon Poya Day", 10, 17),
            new("Ill Full Moon Poya Day", 11, 15),
            new("Unduvap Full Moon Poya Day", 12, 14),
        ],
        [2025] =
        [
            new("Duruthu Full Moon Poya Day", 1, 13),
            new("Navam Full Moon Poya Day", 2, 12),
            new("Madin Full Moon Poya Day", 3, 13),
            new("Bak Full Moon Poya Day", 4, 12),
            new("Vesak Full Moon Poya Day", 5, 12),
            new("Poson Full Moon Poya Day", 6, 10),
            new("Esala Full Moon Poya Day", 7, 10),
            new("Nikini Full Moon Poya Day", 8, 8),
            new("Binara Full Moon Poya Day", 9, 7),
            new("Vap Full Moon Poya Day", 10, 6),
            new("Ill Full Moon Poya Day", 11, 5),
            new("Unduvap Full Moon Poya Day", 12, 4),
        ],
        [2026] =
        [
            new("Duruthu Full Moon Poya Day", 1, 3),
            new("Nawam Full Moon Poya Day", 2, 1),
            new("Medin Full Moon Poya Day", 3, 2),
            new("Bak Full Moon Poya Day", 4, 1),
            new("Adhi Vesak Full Moon Poya Day", 5, 1),
            new("Vesak Full Moon Poya Day", 5, 30),
            new("Poson Full Moon Poya Day", 6, 29),
            new("Esala Full Moon Poya Day", 7, 29),
            new("Nikini Full Moon Poya Day", 8, 27),
            new("Binara Full Moon Poya Day", 9, 26),
            new("Vap Full Moon Poya Day", 10, 25),
            new("Ill Full Moon Poya Day", 11, 24),
            new("Unduvap Full Moon Poya Day", 12, 23),
        ],
        [2027] =
        [
            new("Duruthu Full Moon Poya Day", 1, 12),
            new("Navam Full Moon Poya Day", 2, 25),
            new("Madin Full Moon Poya Day", 3, 25),
            new("Bak Full Moon Poya Day", 4, 24),
            new("Vesak Full Moon Poya Day", 5, 23),
            new("Poson Full Moon Poya Day", 6, 22),
            new("Esala Full Moon Poya Day", 7, 21),
            new("Nikini Full Moon Poya Day", 8, 20),
            new("Binara Full Moon Poya Day", 9, 18),
            new("Vap Full Moon Poya Day", 10, 18),
            new("Ill Full Moon Poya Day", 11, 16),
            new("Unduvap Full Moon Poya Day", 12, 16),
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
