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
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), _timeZone);
            return DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        }
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
