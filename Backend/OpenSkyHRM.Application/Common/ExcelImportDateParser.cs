using System.Globalization;
using System.Text.RegularExpressions;

namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Calendar dates from Excel/CSV. Sri Lanka sheets use day/month (05/03/1990 = 5 March).
/// Server culture is often en-US, so <see cref="DateTime.TryParse"/> would swap those to May 3.
/// </summary>
public static partial class ExcelImportDateParser
{
    private static readonly string[] IsoFormats =
    [
        "yyyy-MM-dd", "yyyy/M/d", "yyyy/MM/dd", "yyyyMMdd",
        "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ss.fff",
        "yyyy-MM-dd HH:mm:ss",
    ];

    private static readonly string[] DayFirstFormats =
    [
        "d/M/yyyy", "dd/MM/yyyy", "d/M/yy", "dd/MM/yy",
        "d-M-yyyy", "dd-MM-yyyy", "d-M-yy", "dd-MM-yy",
        "d.M.yyyy", "dd.MM.yyyy",
        "d MMM yyyy", "dd MMM yyyy", "d MMMM yyyy", "dd MMMM yyyy",
        "d-MMM-yyyy", "dd-MMM-yyyy", "d-MMMM-yyyy", "dd-MMMM-yyyy",
    ];

    private static readonly string[] MonthFirstFormats =
    [
        "M/d/yyyy", "MM/dd/yyyy", "M/d/yy", "MM/dd/yy",
        "MMM d yyyy", "MMMM d yyyy", "MMM-d-yyyy", "MMMM d, yyyy",
        "MMM d, yyyy",
    ];

    public static DateTime? ParseWallDate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (IsEmptyToken(s)) return null;

        var enGb = CultureInfo.GetCultureInfo("en-GB");
        var invariant = CultureInfo.InvariantCulture;

        if (TryExact(s, IsoFormats, invariant, out var iso)) return ToWallDate(iso);
        if (TryExact(s, DayFirstFormats, enGb, out var dayFirst)) return ToWallDate(dayFirst);
        if (DateTime.TryParse(s, enGb, DateTimeStyles.None, out var gb)) return ToWallDate(gb);

        // Unambiguous US dates (month/day where day > 12), e.g. 3/15/1990.
        if (TryExact(s, MonthFirstFormats, invariant, out var monthFirst)) return ToWallDate(monthFirst);
        if (DateTime.TryParse(s, invariant, DateTimeStyles.None, out var inv)) return ToWallDate(inv);
        if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var current))
            return ToWallDate(current);

        return null;
    }

    public static DateTime FromExcelSerial(double oaDate)
    {
        var dt = DateTime.FromOADate(oaDate);
        return ToWallDate(dt);
    }

    /// <summary>
    /// Clock time from an Excel punch cell. The attendance Date column is the day;
    /// any date inside the punch value is ignored so culture cannot swap day/month onto Punch In/Out.
    /// </summary>
    public static DateTime? CombineAttendanceDateAndPunch(DateTime attendanceDate, string? raw)
    {
        var tod = ParseTimeOfDay(raw);
        if (tod is null) return null;
        return DateTime.SpecifyKind(attendanceDate.Date.Add(tod.Value), DateTimeKind.Unspecified);
    }

    /// <summary>
    /// Night / split / 24h shifts often punch out on the next calendar day while the Excel Date
    /// column stays on the shift start day. Same clock time in and out (e.g. 07:00–07:00) means
    /// a full 24h shift ending the next day. Same rule as fingerprint first-in/last-out.
    /// </summary>
    public static DateTime ApplyOvernightPunchOutIfNeeded(DateTime punchIn, DateTime punchOut)
    {
        if (punchOut <= punchIn)
            return DateTime.SpecifyKind(punchOut.AddDays(1), DateTimeKind.Unspecified);
        return punchOut;
    }

    /// <summary>
    /// Excel time serial (0.354 = 08:30) or a clock typed as a number (8.30 = 08:30).
    /// Values 1–23.59 are treated as H.mm, not as 1900-era dates.
    /// </summary>
    public static TimeSpan? FromExcelNumber(double n)
    {
        if (double.IsNaN(n) || double.IsInfinity(n) || n < 0 || n >= 2958466)
            return null;
        if (n < 1)
            return RoundToSecond(TimeSpan.FromDays(n));

        var hours = (int)Math.Truncate(n);
        var minutes = (int)Math.Round((n - hours) * 100, MidpointRounding.AwayFromZero);
        if (hours is >= 0 and <= 23 && minutes is >= 0 and <= 59)
            return new TimeSpan(hours, minutes, 0);

        if (Math.Abs(n - Math.Truncate(n)) > 1e-9)
        {
            try { return RoundToSecond(DateTime.FromOADate(n).TimeOfDay); }
            catch (ArgumentException) { return null; }
        }

        return null;
    }

    public static TimeSpan? ParseTimeOfDay(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var s = raw.Trim();
        if (IsEmptyToken(s)) return null;

        var invariant = CultureInfo.InvariantCulture;
        var enGb = CultureInfo.GetCultureInfo("en-GB");
        var enUs = CultureInfo.GetCultureInfo("en-US");

        foreach (var culture in new[] { invariant, enGb, enUs })
        {
            if (DateTime.TryParseExact(s, TimeOnlyFormats, culture, DateTimeStyles.NoCurrentDateDefault, out var exact))
                return RoundToSecond(exact.TimeOfDay);
        }

        if (TryParseDottedOrCompactClock(s, out var typedClock))
            return typedClock;

        if (TimeSpan.TryParse(s, invariant, out var ts) && ts >= TimeSpan.Zero && ts < TimeSpan.FromDays(1))
            return RoundToSecond(ts);

        if (double.TryParse(s, NumberStyles.Float, invariant, out var n) && n is >= 0 and < 2958466)
        {
            var fromNumber = FromExcelNumber(n);
            if (fromNumber is not null)
                return fromNumber;
        }

        foreach (var culture in new[] { enGb, invariant, enUs })
        {
            if (DateTime.TryParseExact(s, DateTimeWithTimeFormats, culture, DateTimeStyles.None, out var dt)
                || DateTime.TryParse(s, culture, DateTimeStyles.None, out dt))
                return RoundToSecond(dt.TimeOfDay);
        }

        var match = TimeOfDayRegex().Match(s);
        if (match.Success
            && int.TryParse(match.Groups["h"].Value, out var h)
            && int.TryParse(match.Groups["m"].Value, out var m))
        {
            if (match.Groups["ampm"].Success)
            {
                var ampm = match.Groups["ampm"].Value.ToLowerInvariant();
                if (ampm == "pm" && h < 12) h += 12;
                if (ampm == "am" && h == 12) h = 0;
            }

            var sec = 0;
            if (match.Groups["sec"].Success)
                int.TryParse(match.Groups["sec"].Value, out sec);
            if (h is >= 0 and < 24 && m is >= 0 and < 60 && sec is >= 0 and < 60)
                return new TimeSpan(h, m, sec);
        }

        return null;
    }

    private static readonly string[] TimeOnlyFormats =
    [
        "H:mm", "HH:mm", "H:mm:ss", "HH:mm:ss",
        "h:mm tt", "hh:mm tt", "h:mm:ss tt", "hh:mm:ss tt",
        "h:mmtt", "hh:mmtt", "h:mm:sstt", "hh:mm:sstt",
    ];

    private static readonly string[] DateTimeWithTimeFormats =
    [
        "yyyy-MM-dd HH:mm", "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss",
        "d/M/yyyy HH:mm", "dd/MM/yyyy HH:mm", "d/M/yyyy H:mm", "dd/MM/yyyy H:mm",
        "d/M/yyyy h:mm tt", "dd/MM/yyyy h:mm tt", "d/M/yyyy hh:mm tt", "dd/MM/yyyy hh:mm tt",
        "M/d/yyyy h:mm tt", "MM/dd/yyyy h:mm tt", "M/d/yyyy hh:mm tt", "MM/dd/yyyy hh:mm tt",
    ];

    [GeneratedRegex(@"(?<h>\d{1,2}):(?<m>\d{2})(?::(?<sec>\d{2}))?\s*(?<ampm>am|pm)?\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex TimeOfDayRegex();

    [GeneratedRegex(@"^(?<h>\d{1,2})[.\-](?<m>\d{2})(?:[.\-](?<sec>\d{2}))?\s*(?<ampm>am|pm)?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DottedClockRegex();

    [GeneratedRegex(@"^(?<hmm>\d{3,4})$", RegexOptions.CultureInvariant)]
    private static partial Regex CompactClockRegex();

    private static bool TryParseDottedOrCompactClock(string s, out TimeSpan tod)
    {
        tod = default;
        var dotted = DottedClockRegex().Match(s);
        if (dotted.Success
            && int.TryParse(dotted.Groups["h"].Value, out var h)
            && int.TryParse(dotted.Groups["m"].Value, out var m))
        {
            if (dotted.Groups["ampm"].Success)
            {
                var ampm = dotted.Groups["ampm"].Value.ToLowerInvariant();
                if (ampm == "pm" && h < 12) h += 12;
                if (ampm == "am" && h == 12) h = 0;
            }

            var sec = 0;
            if (dotted.Groups["sec"].Success)
                int.TryParse(dotted.Groups["sec"].Value, out sec);
            if (h is >= 0 and < 24 && m is >= 0 and < 60 && sec is >= 0 and < 60)
            {
                tod = new TimeSpan(h, m, sec);
                return true;
            }
        }

        var compact = CompactClockRegex().Match(s);
        if (compact.Success && int.TryParse(compact.Groups["hmm"].Value, out var hmm))
        {
            var hours = hmm / 100;
            var minutes = hmm % 100;
            if (hours is >= 0 and < 24 && minutes is >= 0 and < 60)
            {
                tod = new TimeSpan(hours, minutes, 0);
                return true;
            }
        }

        return false;
    }

    private static TimeSpan RoundToSecond(TimeSpan t)
    {
        var seconds = (long)Math.Round(t.TotalSeconds, MidpointRounding.AwayFromZero);
        if (seconds < 0) seconds = 0;
        if (seconds >= 24 * 60 * 60) seconds = 24 * 60 * 60 - 1;
        return TimeSpan.FromSeconds(seconds);
    }

    /// <summary>
    /// Calendar date only. Excel serials can land at 23:59:59.xxx of the previous day from IEEE rounding.
    /// </summary>
    public static DateTime ToWallDate(DateTime value)
    {
        var date = value.Date;
        if (value.TimeOfDay > new TimeSpan(23, 50, 0))
            date = date.AddDays(1);
        return DateTime.SpecifyKind(date, DateTimeKind.Unspecified);
    }

    public static bool IsEmptyToken(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return true;
        var t = s.Trim();
        return t is "0" or "-" or "." or "#"
            || t.Equals("#N/A", StringComparison.OrdinalIgnoreCase)
            || t.Equals("N/A", StringComparison.OrdinalIgnoreCase)
            || t.Equals("NA", StringComparison.OrdinalIgnoreCase)
            || t.Equals("null", StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryExact(string s, string[] formats, CultureInfo culture, out DateTime dt) =>
        DateTime.TryParseExact(s, formats, culture, DateTimeStyles.None, out dt);
}
