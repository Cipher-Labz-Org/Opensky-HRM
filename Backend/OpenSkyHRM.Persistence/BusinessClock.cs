using System.Globalization;
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

        var text = input.Trim();

        // A trailing Z or offset is an instant. Convert it to the business wall clock.
        // DateTime.TryParse would instead shift it into the server's timezone, so a
        // 08:00 punch can land hours away from the fingerprint machine.
        if (HasExplicitOffset(text))
        {
            if (!DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var instant))
                return false;

            localWall = ToBusinessLocal(DateTime.SpecifyKind(instant.UtcDateTime, DateTimeKind.Utc));
            return true;
        }

        if (!DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
            && !DateTime.TryParse(text, CultureInfo.CurrentCulture, DateTimeStyles.None, out parsed))
            return false;

        // Fingerprint devices send wall clock in the business timezone without an offset.
        localWall = DateTime.SpecifyKind(parsed, DateTimeKind.Unspecified);
        return true;
    }

    private static bool HasExplicitOffset(string text)
    {
        if (text.EndsWith('Z') || text.EndsWith('z'))
            return true;
        if (text.Length < 6)
            return false;

        var sign = text[^6];
        return sign is '+' or '-'
            && text[^3] == ':'
            && char.IsDigit(text[^5])
            && char.IsDigit(text[^4])
            && char.IsDigit(text[^2])
            && char.IsDigit(text[^1]);
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
