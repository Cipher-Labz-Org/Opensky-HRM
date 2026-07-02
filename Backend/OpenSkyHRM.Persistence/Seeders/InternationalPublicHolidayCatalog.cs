namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// National public holidays for non–Sri Lanka regions (2024–2027).
/// Sri Lanka uses mercantile + Poya catalogs instead.
/// </summary>
public static class InternationalPublicHolidayCatalog
{
    private sealed record Entry(string Name, int Month, int Day);

    private static readonly Dictionary<string, Dictionary<int, Entry[]>> ByCountryYear = new()
    {
        ["US"] = new()
        {
            [2024] =
            [
                new("New Year's Day", 1, 1), new("Martin Luther King Jr. Day", 1, 15),
                new("Presidents' Day", 2, 19), new("Memorial Day", 5, 27),
                new("Juneteenth National Independence Day", 6, 19), new("Independence Day", 7, 4),
                new("Labor Day", 9, 2), new("Columbus Day", 10, 14),
                new("Veterans Day", 11, 11), new("Thanksgiving Day", 11, 28), new("Christmas Day", 12, 25),
            ],
            [2025] =
            [
                new("New Year's Day", 1, 1), new("Martin Luther King Jr. Day", 1, 20),
                new("Presidents' Day", 2, 17), new("Memorial Day", 5, 26),
                new("Juneteenth National Independence Day", 6, 19), new("Independence Day", 7, 4),
                new("Labor Day", 9, 1), new("Columbus Day", 10, 13),
                new("Veterans Day", 11, 11), new("Thanksgiving Day", 11, 27), new("Christmas Day", 12, 25),
            ],
            [2026] =
            [
                new("New Year's Day", 1, 1), new("Martin Luther King Jr. Day", 1, 19),
                new("Presidents' Day", 2, 16), new("Memorial Day", 5, 25),
                new("Juneteenth National Independence Day", 6, 19), new("Independence Day", 7, 4),
                new("Labor Day", 9, 7), new("Columbus Day", 10, 12),
                new("Veterans Day", 11, 11), new("Thanksgiving Day", 11, 26), new("Christmas Day", 12, 25),
            ],
            [2027] =
            [
                new("New Year's Day", 1, 1), new("Martin Luther King Jr. Day", 1, 18),
                new("Presidents' Day", 2, 15), new("Memorial Day", 5, 31),
                new("Juneteenth National Independence Day", 6, 19), new("Independence Day", 7, 4),
                new("Labor Day", 9, 6), new("Columbus Day", 10, 11),
                new("Veterans Day", 11, 11), new("Thanksgiving Day", 11, 25), new("Christmas Day", 12, 25),
            ],
        },
        ["GB"] = new()
        {
            [2024] =
            [
                new("New Year's Day", 1, 1), new("Good Friday", 3, 29), new("Easter Monday", 4, 1),
                new("Early May bank holiday", 5, 6), new("Spring bank holiday", 5, 27),
                new("Summer bank holiday", 8, 26), new("Christmas Day", 12, 25), new("Boxing Day", 12, 26),
            ],
            [2025] =
            [
                new("New Year's Day", 1, 1), new("Good Friday", 4, 18), new("Easter Monday", 4, 21),
                new("Early May bank holiday", 5, 5), new("Spring bank holiday", 5, 26),
                new("Summer bank holiday", 8, 25), new("Christmas Day", 12, 25), new("Boxing Day", 12, 26),
            ],
            [2026] =
            [
                new("New Year's Day", 1, 1), new("Good Friday", 4, 3), new("Easter Monday", 4, 6),
                new("Early May bank holiday", 5, 4), new("Spring bank holiday", 5, 25),
                new("Summer bank holiday", 8, 31), new("Christmas Day", 12, 25), new("Boxing Day", 12, 28),
            ],
            [2027] =
            [
                new("New Year's Day", 1, 1), new("Good Friday", 3, 26), new("Easter Monday", 3, 29),
                new("Early May bank holiday", 5, 3), new("Spring bank holiday", 5, 31),
                new("Summer bank holiday", 8, 30), new("Christmas Day", 12, 25), new("Boxing Day", 12, 28),
            ],
        },
        ["IN"] = new()
        {
            [2024] =
            [
                new("Republic Day", 1, 26), new("Holi", 3, 25), new("Independence Day", 8, 15),
                new("Gandhi Jayanti", 10, 2), new("Diwali", 11, 1), new("Christmas Day", 12, 25),
            ],
            [2025] =
            [
                new("Republic Day", 1, 26), new("Holi", 3, 14), new("Independence Day", 8, 15),
                new("Gandhi Jayanti", 10, 2), new("Diwali", 10, 20), new("Christmas Day", 12, 25),
            ],
            [2026] =
            [
                new("Republic Day", 1, 26), new("Holi", 3, 3), new("Independence Day", 8, 15),
                new("Gandhi Jayanti", 10, 2), new("Diwali", 11, 8), new("Christmas Day", 12, 25),
            ],
            [2027] =
            [
                new("Republic Day", 1, 26), new("Holi", 3, 22), new("Independence Day", 8, 15),
                new("Gandhi Jayanti", 10, 2), new("Diwali", 10, 29), new("Christmas Day", 12, 25),
            ],
        },
        ["AU"] = new()
        {
            [2024] =
            [
                new("New Year's Day", 1, 1), new("Australia Day", 1, 26),
                new("Good Friday", 3, 29), new("Easter Monday", 4, 1), new("Anzac Day", 4, 25),
                new("Christmas Day", 12, 25), new("Boxing Day", 12, 26),
            ],
            [2025] =
            [
                new("New Year's Day", 1, 1), new("Australia Day", 1, 27),
                new("Good Friday", 4, 18), new("Easter Monday", 4, 21), new("Anzac Day", 4, 25),
                new("Christmas Day", 12, 25), new("Boxing Day", 12, 26),
            ],
            [2026] =
            [
                new("New Year's Day", 1, 1), new("Australia Day", 1, 26),
                new("Good Friday", 4, 3), new("Easter Monday", 4, 6), new("Anzac Day", 4, 25),
                new("Christmas Day", 12, 25), new("Boxing Day", 12, 28),
            ],
            [2027] =
            [
                new("New Year's Day", 1, 1), new("Australia Day", 1, 26),
                new("Good Friday", 3, 26), new("Easter Monday", 3, 29), new("Anzac Day", 4, 25),
                new("Christmas Day", 12, 25), new("Boxing Day", 12, 28),
            ],
        },
    };

    public static IReadOnlyList<(string Name, DateTime Date)> ForCountryYear(string countryCode, int year)
    {
        if (!ByCountryYear.TryGetValue(countryCode, out var byYear))
            return Array.Empty<(string, DateTime)>();
        if (!byYear.TryGetValue(year, out var entries))
            return Array.Empty<(string, DateTime)>();

        return entries
            .Select(e => (e.Name, new DateTime(year, e.Month, e.Day, 0, 0, 0, DateTimeKind.Utc)))
            .ToList();
    }

    public static IEnumerable<string> SupportedCountries => ByCountryYear.Keys;
}
