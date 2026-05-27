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
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(id);
        }
        catch (TimeZoneNotFoundException)
        {
            // Windows may not have IANA id
            if (string.Equals(id, "Asia/Colombo", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("Sri Lanka Standard Time");
                }
                catch (TimeZoneNotFoundException)
                {
                    // Fall back
                }
            }

            return TimeZoneInfo.Utc;
        }
    }
}
