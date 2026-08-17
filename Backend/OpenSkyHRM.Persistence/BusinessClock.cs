using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Domain;

namespace OpenSkyHRM.Persistence;

public sealed class BusinessClock : IBusinessClock
{
    private readonly TimeZoneInfo _timeZone;

    public BusinessClock(IConfiguration configuration)
    {
        var id = configuration["BusinessTime:TimeZoneId"]?.Trim();
        _timeZone = ResolveTimeZone(string.IsNullOrEmpty(id) ? "Asia/Colombo" : id);
    }

    public DateTime Now
    {
        get
        {
            var utc = DateTime.UtcNow;
            return ToBusinessLocal(utc);
        }
    }

    public bool TryParseDeviceTimestamp(string? input, out DateTime localWall)
    {
        localWall = default;
        if (string.IsNullOrWhiteSpace(input))
            return false;

        if (!DateTime.TryParse(input, out var parsed))
            return false;

        // Fingerprint devices send wall clock in business timezone without an offset.
        localWall = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
        return true;
    }

    public DateTime ToBusinessLocal(DateTime utcInstant)
    {
        var utc = utcInstant.Kind switch
        {
            DateTimeKind.Utc => utcInstant,
            DateTimeKind.Local => utcInstant.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utcInstant, DateTimeKind.Utc),
        };
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, _timeZone);
        return DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
    }

    private static TimeZoneInfo ResolveTimeZone(string id)
    {
        foreach (var candidate in TimeZoneCandidates(id))
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        // Never fall back to UTC — that reintroduces the 5:30 / 12:30 punch skew.
        return TimeZoneInfo.CreateCustomTimeZone(
            "Asia/Colombo",
            TimeSpan.FromHours(5.5),
            "Sri Lanka Standard Time",
            "Sri Lanka Standard Time");
    }

    private static IEnumerable<string> TimeZoneCandidates(string id)
    {
        yield return id;
        if (string.Equals(id, "Asia/Colombo", StringComparison.OrdinalIgnoreCase))
            yield return "Sri Lanka Standard Time";
        else if (string.Equals(id, "Sri Lanka Standard Time", StringComparison.OrdinalIgnoreCase))
            yield return "Asia/Colombo";
    }
}
