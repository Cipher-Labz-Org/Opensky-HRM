using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class AttendancePunchTimesTests
{
    /// <summary>Colombo = UTC+5:30; test host treated as Pacific (UTC−7) when Kind is Local.</summary>
    private sealed class PacificHostColomboClock : IBusinessClock
    {
        public DateTime Now => throw new NotSupportedException();

        public bool TryParseDeviceTimestamp(string? input, out DateTime localWall)
        {
            localWall = default;
            return false;
        }

        public DateTime ToBusinessLocal(DateTime utcInstant)
        {
            var utc = utcInstant.Kind switch
            {
                DateTimeKind.Utc => utcInstant,
                DateTimeKind.Local => utcInstant.AddHours(7),
                _ => DateTime.SpecifyKind(utcInstant, DateTimeKind.Utc),
            };
            return DateTime.SpecifyKind(utc.AddHours(5.5), DateTimeKind.Unspecified);
        }
    }

    [Fact]
    public void Utc_mobile_punch_converts_to_colombo()
    {
        var clock = new PacificHostColomboClock();
        var utc = new DateTime(2026, 8, 12, 6, 37, 0, DateTimeKind.Utc);

        var shown = AttendancePunchTimes.ToApiWallClock(utc, "Mobile QR", clock);

        Assert.Equal(new DateTime(2026, 8, 12, 12, 7, 0), shown);
        Assert.Equal(DateTimeKind.Unspecified, shown!.Value.Kind);
    }

    [Fact]
    public void Unspecified_utc_clock_from_new_storage_shows_colombo()
    {
        var clock = new PacificHostColomboClock();
        var stored = new DateTime(2026, 8, 12, 6, 37, 0, DateTimeKind.Unspecified);

        var shown = AttendancePunchTimes.ToApiWallClock(stored, "Mobile QR", clock);

        Assert.Equal(new DateTime(2026, 8, 12, 12, 7, 0), shown);
    }

    [Fact]
    public void Unspecified_pacific_legacy_row_is_shifted_by_twelve_hours_thirty()
    {
        var clock = new PacificHostColomboClock();
        // DateTime.Now on a UTC−7 host while Colombo is 12:07 PM.
        var stored = new DateTime(2026, 8, 11, 23, 37, 0, DateTimeKind.Unspecified);

        var shown = AttendancePunchTimes.ToApiWallClock(stored, "Mobile QR", clock);

        Assert.Equal(new DateTime(2026, 8, 12, 12, 7, 0), shown);
    }

    [Fact]
    public void Import_wall_clock_is_left_unchanged()
    {
        var clock = new PacificHostColomboClock();
        var entered = new DateTime(2026, 8, 12, 9, 0, 0, DateTimeKind.Unspecified);

        var shown = AttendancePunchTimes.ToApiWallClock(entered, "Import", clock);

        Assert.Equal(entered, shown);
    }

    [Fact]
    public void Utc_web_punch_converts_to_colombo()
    {
        var clock = new PacificHostColomboClock();
        var utc = new DateTime(2026, 9, 22, 5, 20, 0, DateTimeKind.Utc);

        var shown = AttendancePunchTimes.ToApiWallClock(utc, "Web", clock);

        Assert.Equal(new DateTime(2026, 9, 22, 10, 50, 0), shown);
        Assert.Equal(DateTimeKind.Unspecified, shown!.Value.Kind);
    }

    [Fact]
    public void Unspecified_web_punch_stored_as_utc_clock_shows_colombo()
    {
        var clock = new PacificHostColomboClock();
        var stored = new DateTime(2026, 9, 22, 5, 46, 0, DateTimeKind.Unspecified);

        var shown = AttendancePunchTimes.ToApiWallClock(stored, "Web", clock);

        Assert.Equal(new DateTime(2026, 9, 22, 11, 16, 0), shown);
    }

    [Fact]
    public void Report_hhmm_matches_attendance_page_for_unspecified_utc_web_punch()
    {
        var clock = new PacificHostColomboClock();
        var storedIn = new DateTime(2026, 10, 21, 5, 30, 0, DateTimeKind.Unspecified);
        var storedOut = new DateTime(2026, 10, 21, 5, 33, 0, DateTimeKind.Unspecified);

        var punchIn = AttendancePunchTimes.ToApiWallClock(storedIn, "Web", clock);
        var punchOut = AttendancePunchTimes.ToApiWallClock(storedOut, "Web", clock);

        Assert.Equal("11:00", punchIn?.ToString("HH:mm"));
        Assert.Equal("11:03", punchOut?.ToString("HH:mm"));
    }

    [Fact]
    public void Business_clock_never_falls_back_to_utc()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BusinessTime:TimeZoneId"] = "Not/ARealZone",
            })
            .Build();
        var clock = new BusinessClock(config);
        var utc = new DateTime(2026, 8, 12, 6, 37, 0, DateTimeKind.Utc);

        Assert.Equal(new DateTime(2026, 8, 12, 12, 7, 0), clock.ToBusinessLocal(utc));
    }

    [Fact]
    public void Device_wall_clock_without_offset_is_kept()
    {
        var clock = new BusinessClock(new ConfigurationBuilder().Build());

        Assert.True(clock.TryParseDeviceTimestamp("2026-10-01 07:04:00", out var wall));
        Assert.Equal(new DateTime(2026, 10, 1, 7, 4, 0), wall);
        Assert.Equal(DateTimeKind.Unspecified, wall.Kind);
    }

    [Fact]
    public void Device_timestamp_with_z_converts_to_colombo_wall()
    {
        var clock = new BusinessClock(new ConfigurationBuilder().Build());

        Assert.True(clock.TryParseDeviceTimestamp("2026-10-01T01:34:00Z", out var wall));
        Assert.Equal(new DateTime(2026, 10, 1, 7, 4, 0), wall);
    }
}
