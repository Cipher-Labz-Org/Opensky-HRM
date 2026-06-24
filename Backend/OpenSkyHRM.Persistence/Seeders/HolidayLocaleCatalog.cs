namespace OpenSkyHRM.Persistence.Seeders;

public static class HolidayLocaleCatalog
{
    public sealed record CountryOption(string Code, string Label);
    public sealed record TimeZoneOption(string Id, string Label, string CountryCode);

    public static readonly IReadOnlyList<CountryOption> Countries =
    [
        new("LK", "Sri Lanka"),
        new("US", "United States"),
        new("GB", "United Kingdom"),
        new("IN", "India"),
        new("AU", "Australia"),
    ];

    public static readonly IReadOnlyList<TimeZoneOption> TimeZones =
    [
        new("Asia/Colombo", "Sri Lanka (UTC+5:30)", "LK"),
        new("Asia/Kolkata", "India (UTC+5:30)", "IN"),
        new("Asia/Singapore", "Singapore (UTC+8)", "LK"),
        new("Europe/London", "United Kingdom (UTC+0/+1)", "GB"),
        new("America/New_York", "US Eastern (UTC-5/-4)", "US"),
        new("America/Chicago", "US Central (UTC-6/-5)", "US"),
        new("America/Los_Angeles", "US Pacific (UTC-8/-7)", "US"),
        new("Australia/Sydney", "Australia Eastern (UTC+10/+11)", "AU"),
        new("Australia/Perth", "Australia Western (UTC+8)", "AU"),
        new("UTC", "UTC", "US"),
    ];

    public const string DefaultCountryCode = "LK";
    public const string DefaultTimeZoneId = "Asia/Colombo";
    public const string CountrySettingKey = "HolidayCountryCode";
    public const string TimeZoneSettingKey = "HolidayTimeZoneId";
}
