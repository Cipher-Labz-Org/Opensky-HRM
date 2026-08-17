using OpenSkyHRM.Domain;

namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Mobile punches must be shown as Asia/Colombo wall clock. Stage Cafe's API host is
/// UTC−7 (Pacific), so <c>DateTime.Now</c> rows are 12 hours 30 minutes behind Colombo.
/// </summary>
public static class AttendancePunchTimes
{
    public static DateTime AsWallClock(DateTime value) =>
        DateTime.SpecifyKind(value, DateTimeKind.Unspecified);

    public static DateTime? ToApiWallClock(DateTime? value, string? source, IBusinessClock clock)
    {
        if (!value.HasValue)
            return null;

        var dt = value.Value;
        if (!IsDevicePunch(source))
            return AsWallClock(dt);

        var colombo = dt.Kind switch
        {
            DateTimeKind.Utc or DateTimeKind.Local => clock.ToBusinessLocal(dt),
            _ => ResolveUnspecifiedDevicePunch(dt, clock),
        };
        return AsWallClock(colombo);
    }

    public static bool IsDevicePunch(string? source)
    {
        if (string.IsNullOrWhiteSpace(source))
            return true;

        return source.Contains("Mobile", StringComparison.OrdinalIgnoreCase)
            || source.Contains("PeopleProfile", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// After a <c>timestamp without time zone</c> round-trip, Kind is Unspecified.
    /// New punches are stored as UTC; legacy Stage Cafe rows are server-local Pacific.
    /// Prefer the interpretation that lands in a normal work-day clock.
    /// </summary>
    public static DateTime ResolveUnspecifiedDevicePunch(DateTime stored, IBusinessClock clock)
    {
        var fromUtc = clock.ToBusinessLocal(DateTime.SpecifyKind(stored, DateTimeKind.Utc));
        if (IsPlausiblePunchHour(fromUtc.Hour))
            return fromUtc;

        var fromLocal = clock.ToBusinessLocal(DateTime.SpecifyKind(stored, DateTimeKind.Local));
        if (IsPlausiblePunchHour(fromLocal.Hour))
            return fromLocal;

        return fromUtc;
    }

    private static bool IsPlausiblePunchHour(int hour) => hour is >= 6 and <= 23;
}
