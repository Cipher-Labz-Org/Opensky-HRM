using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class BiometricPunchTimeRepairTests
{
    private static readonly DateTime CorrectIn = new(2026, 9, 15, 9, 37, 0);
    private static readonly DateTime CorrectOut = new(2026, 9, 15, 18, 38, 0);
    private static readonly DateTime SkewedIn = CorrectIn.AddHours(-12.5);
    private static readonly DateTime SkewedOut = CorrectOut.AddHours(-12.5);

    private const string Payload =
        "[{\"EmpId\":\"689\",\"AttTime\":\"2026-09-15T04:07:00Z\",\"DeviceID\":\"SN1\"}," +
        "{\"EmpId\":\"689\",\"AttTime\":\"2026-09-15T13:08:00Z\",\"DeviceID\":\"SN1\"}]";

    [Theory]
    [InlineData("2026-09-15T04:07:00Z")]
    [InlineData("2026-09-15T04:07:00+00:00")]
    [InlineData("2026-09-14T21:07:00-07:00")]
    [InlineData("2026-09-15T09:37:00+05:30")]
    public void Parser_reads_the_same_instant_as_colombo_wall_clock_whatever_the_offset(string attTime)
    {
        var parser = new AdmsPayloadParser(new BusinessClock(new ConfigurationBuilder().Build()));

        var punch = Assert.Single(parser.ParsePunches($"{{\"EmpId\":\"689\",\"AttTime\":\"{attTime}\"}}"));

        Assert.Equal(CorrectIn, punch.PunchAtUtc);
        Assert.Equal(DateTimeKind.Unspecified, punch.PunchAtUtc.Kind);
    }

    [Fact]
    public async Task Ingest_stores_utc_payload_as_colombo_wall_clock()
    {
        await using var db = CreateDb(out var clock);
        AddEmployee(db);
        await db.SaveChangesAsync();
        var biometric = new BiometricService(db);
        var ingest = new BiometricAdmsIngestService(db, biometric, clock, NullLogger<BiometricAdmsIngestService>.Instance);

        await ingest.IngestAsync(Payload, "SN1", null, "webhook");

        var times = await db.BiometricPunchEvents.Select(p => p.PunchAtUtc).OrderBy(t => t).ToListAsync();
        Assert.Equal(new[] { CorrectIn, CorrectOut }, times);
        var record = await db.AttendanceRecords.SingleAsync();
        Assert.Equal(CorrectIn.Date, record.Date);
        Assert.Equal(CorrectIn, record.PunchIn);
        Assert.Equal(CorrectOut, record.PunchOut);
    }

    [Fact]
    public async Task Repair_corrects_skewed_punches_and_moves_attendance_to_the_right_day()
    {
        await using var db = CreateDb(out var clock);
        var seed = await SeedSkewedHistoryAsync(db);

        var report = await CreateRepair(db, clock).RunAsync(dryRun: false);

        Assert.Equal(2, report.PunchesCorrected);
        Assert.Equal(0, report.DuplicatesRemoved);
        var punches = await db.BiometricPunchEvents.OrderBy(p => p.PunchAtUtc).ToListAsync();
        Assert.Equal(new[] { CorrectIn, CorrectOut }, punches.Select(p => p.PunchAtUtc));
        Assert.Equal(
            AdmsPayloadParser.ComputeDedupe(seed.DeviceId, "689", CorrectIn, null, null, null),
            punches[0].DedupeHash);

        var sep15 = await db.AttendanceRecords.SingleAsync(a => a.Date == CorrectIn.Date);
        Assert.Equal("Present", sep15.Status);
        Assert.Equal(CorrectIn, sep15.PunchIn);
        Assert.Equal(CorrectOut, sep15.PunchOut);
        Assert.Equal(9.02m, sep15.WorkedHours);
    }

    [Fact]
    public async Task Repair_turns_a_ghost_day_into_absent()
    {
        await using var db = CreateDb(out var clock);
        await SeedSkewedHistoryAsync(db);

        await CreateRepair(db, clock).RunAsync(dryRun: false);

        var sep14 = await db.AttendanceRecords.SingleAsync(a => a.Date == SkewedIn.Date);
        Assert.Equal("Absent", sep14.Status);
        Assert.Equal("System", sep14.Source);
        Assert.Null(sep14.PunchIn);
        Assert.Null(sep14.PunchOut);
        Assert.Null(sep14.WorkedHours);
    }

    [Fact]
    public async Task Repair_removes_the_wrong_copy_when_the_correct_copy_was_saved_later()
    {
        await using var db = CreateDb(out var clock);
        var seed = await SeedSkewedHistoryAsync(db);
        var resend = new BiometricRawEvent
        {
            DeviceId = seed.DeviceId,
            ReceivedAtUtc = new DateTime(2026, 10, 9),
            Payload = "{\"EmpId\":\"689\",\"AttTime\":\"2026-09-15T04:07:00Z\"}",
            ParseStatus = "Parsed",
        };
        db.BiometricRawEvents.Add(resend);
        db.BiometricPunchEvents.Add(Punch(seed.DeviceId, resend.Id, CorrectIn));
        await db.SaveChangesAsync();

        var report = await CreateRepair(db, clock).RunAsync(dryRun: false);

        Assert.Equal(1, report.DuplicatesRemoved);
        Assert.Equal(1, report.PunchesCorrected);
        var times = await db.BiometricPunchEvents.Select(p => p.PunchAtUtc).OrderBy(t => t).ToListAsync();
        Assert.Equal(new[] { CorrectIn, CorrectOut }, times);
    }

    [Fact]
    public async Task Repair_is_a_no_op_the_second_time()
    {
        await using var db = CreateDb(out var clock);
        await SeedSkewedHistoryAsync(db);
        await CreateRepair(db, clock).RunAsync(dryRun: false);

        var second = await CreateRepair(db, clock).RunAsync(dryRun: false);

        Assert.Equal(0, second.PunchesCorrected);
        Assert.Equal(0, second.DuplicatesRemoved);
        Assert.Equal(0, second.PunchesInserted);
        Assert.Equal(2, second.PunchesUnchanged);
        Assert.Equal(0, second.AttendanceDaysRebuilt);
    }

    [Fact]
    public async Task Dry_run_reports_without_changing_anything()
    {
        await using var db = CreateDb(out var clock);
        await SeedSkewedHistoryAsync(db);

        var report = await CreateRepair(db, clock).RunAsync(dryRun: true);

        Assert.Equal(2, report.PunchesCorrected);
        Assert.Contains(report.Samples, s => s.StoredTime == SkewedIn && s.CorrectTime == CorrectIn && s.EmployeeCode == "689");
        Assert.Equal("2026-09", Assert.Single(report.ByMonth).Month);
        var times = await db.BiometricPunchEvents.AsNoTracking().Select(p => p.PunchAtUtc).OrderBy(t => t).ToListAsync();
        Assert.Equal(new[] { SkewedIn, SkewedOut }, times);
        Assert.Equal("Present", (await db.AttendanceRecords.AsNoTracking().SingleAsync(a => a.Date == SkewedIn.Date)).Status);
    }

    [Fact]
    public async Task Repair_leaves_hand_edited_days_alone()
    {
        await using var db = CreateDb(out var clock);
        await SeedSkewedHistoryAsync(db);
        var sep15 = await db.AttendanceRecords.SingleAsync(a => a.Date == CorrectIn.Date);
        sep15.Source = "Manual";
        sep15.PunchIn = new DateTime(2026, 9, 15, 8, 0, 0);
        await db.SaveChangesAsync();

        var report = await CreateRepair(db, clock).RunAsync(dryRun: false);

        Assert.Equal(1, report.ManualDaysSkipped);
        var after = await db.AttendanceRecords.AsNoTracking().SingleAsync(a => a.Date == CorrectIn.Date);
        Assert.Equal("Manual", after.Source);
        Assert.Equal(new DateTime(2026, 9, 15, 8, 0, 0), after.PunchIn);
    }

    [Fact]
    public async Task Run_once_marks_the_database_and_restarts_the_hours_repair()
    {
        await using var db = CreateDb(out var clock);
        await SeedSkewedHistoryAsync(db);
        db.SystemSettings.Add(new SystemSetting { Key = BiometricPunchTimeRepairService.HoursRepairCursorKey, Value = "2026-09-01" });
        await db.SaveChangesAsync();

        var first = await CreateRepair(db, clock).RunOnceAsync();
        var second = await CreateRepair(db, clock).RunOnceAsync();

        Assert.NotNull(first);
        Assert.Equal(2, first!.PunchesCorrected);
        Assert.Null(second);
        Assert.False(await db.SystemSettings.AnyAsync(s => s.Key == BiometricPunchTimeRepairService.HoursRepairCursorKey));
        var marker = await db.SystemSettings.SingleAsync(s => s.Key == BiometricPunchTimeRepairService.CompletedSettingKey);
        Assert.Contains("corrected=2", marker.Value);
    }

    [Fact]
    public async Task Repair_fixes_a_stored_time_shifted_after_saving_even_when_the_hash_matches()
    {
        await using var db = CreateDb(out var clock);
        var employee = AddEmployee(db);
        var device = new BiometricDevice { Name = "ADMS-SN3", SerialNumber = "SN3" };
        db.BiometricDevices.Add(device);
        var actual = new DateTime(2026, 9, 14, 8, 37, 0);
        var shifted = actual.AddMinutes(750);
        var raw = new BiometricRawEvent
        {
            DeviceId = device.Id,
            ReceivedAtUtc = new DateTime(2026, 9, 14, 3, 7, 0),
            Payload = "{\"EmpId\":\"689\",\"AttTime\":\"2026-09-14 08:37:00\"}",
            ParseStatus = "Parsed",
        };
        db.BiometricRawEvents.Add(raw);
        var hash = AdmsPayloadParser.ComputeDedupe(device.Id, "689", actual, null, null, null);
        db.BiometricPunchEvents.Add(new BiometricPunchEvent
        {
            DeviceId = device.Id,
            RawEventId = raw.Id,
            DeviceUserId = "689",
            PunchAtUtc = shifted,
            DedupeHash = hash,
            ProcessedToAttendance = true,
        });
        db.AttendanceRecords.Add(new AttendanceRecord
        {
            EmployeeId = employee.Id,
            Date = shifted.Date,
            PunchIn = shifted,
            Status = "Present",
            Source = "Biometric",
        });
        await db.SaveChangesAsync();

        var first = await CreateRepair(db, clock).RunAsync(dryRun: false);
        var second = await CreateRepair(db, clock).RunAsync(dryRun: false);

        Assert.Equal(1, first.PunchesCorrected);
        Assert.Contains(first.Samples, s => s.Action == "Stored time shifted" && s.StoredTime == shifted && s.CorrectTime == actual);
        Assert.Equal(0, second.PunchesCorrected);
        Assert.Equal(1, second.PunchesUnchanged);
        var punch = await db.BiometricPunchEvents.AsNoTracking().SingleAsync();
        Assert.Equal(actual, punch.PunchAtUtc);
        Assert.Equal(hash, punch.DedupeHash);
        var record = await db.AttendanceRecords.AsNoTracking().SingleAsync();
        Assert.Equal(actual, record.PunchIn);
    }

    [Fact]
    public async Task Device_clock_correction_previews_then_applies_and_survives_a_reread()
    {
        await using var db = CreateDb(out var clock);
        var employee = AddEmployee(db);
        var device = new BiometricDevice { Name = "ADMS-SN2", SerialNumber = "SN2" };
        db.BiometricDevices.Add(device);
        var wrongClock = new DateTime(2026, 9, 14, 21, 7, 0);
        var raw = new BiometricRawEvent
        {
            DeviceId = device.Id,
            ReceivedAtUtc = new DateTime(2026, 9, 14, 3, 8, 0),
            Payload = "{\"EmpId\":\"689\",\"AttTime\":\"2026-09-14 21:07:00\"}",
            ParseStatus = "Parsed",
        };
        db.BiometricRawEvents.Add(raw);
        db.BiometricPunchEvents.Add(Punch(device.Id, raw.Id, wrongClock));
        db.AttendanceRecords.Add(new AttendanceRecord
        {
            EmployeeId = employee.Id,
            Date = wrongClock.Date,
            PunchIn = wrongClock,
            Status = "Present",
            Source = "Biometric",
        });
        await db.SaveChangesAsync();

        var correction = new DeviceClockCorrectionDto
        {
            DeviceId = device.Id,
            ReceivedFromUtc = new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc),
            ReceivedToUtc = new DateTime(2026, 9, 27, 0, 0, 0, DateTimeKind.Utc),
            OffsetMinutes = -750,
        };
        var repair = CreateRepair(db, clock);

        var preview = await repair.RunAsync(dryRun: true, default, correction);
        Assert.Equal(1, preview.PunchesCorrected);
        Assert.Equal(wrongClock, (await db.BiometricPunchEvents.AsNoTracking().SingleAsync()).PunchAtUtc);
        Assert.Empty(await repair.GetCorrectionsAsync());

        await repair.SaveCorrectionAsync(correction);
        var applied = await CreateRepair(db, clock).RunAsync(dryRun: false);
        var reread = await CreateRepair(db, clock).RunAsync(dryRun: false);

        var expected = new DateTime(2026, 9, 14, 8, 37, 0);
        Assert.Equal(1, applied.PunchesCorrected);
        Assert.Equal(0, reread.PunchesCorrected);
        Assert.Equal(expected, (await db.BiometricPunchEvents.AsNoTracking().SingleAsync()).PunchAtUtc);
        var record = await db.AttendanceRecords.AsNoTracking().SingleAsync(a => a.Date == expected.Date);
        Assert.Equal(expected, record.PunchIn);
    }

    [Fact]
    public async Task Clock_diagnostics_show_the_gap_between_tap_time_and_arrival()
    {
        await using var db = CreateDb(out var clock);
        var device = new BiometricDevice { Name = "ADMS-SN2", SerialNumber = "SN2" };
        db.BiometricDevices.Add(device);
        db.BiometricRawEvents.Add(new BiometricRawEvent
        {
            DeviceId = device.Id,
            ReceivedAtUtc = new DateTime(2026, 9, 14, 3, 7, 0),
            Payload = "{\"EmpId\":\"689\",\"AttTime\":\"2026-09-14 21:07:00\"}",
            ParseStatus = "Parsed",
        });
        await db.SaveChangesAsync();

        var result = await CreateRepair(db, clock).ClockDiagnosticsAsync(
            new DateTime(2026, 9, 1), new DateTime(2026, 10, 1), "689");

        var day = Assert.Single(result.Days);
        Assert.Equal("SN2", day.DeviceSerial);
        Assert.Equal(-750, day.MedianLagMinutes);
        Assert.Equal(0, day.LivePunches);
        Assert.Equal(-750, Assert.Single(result.Punches).LagMinutes);
    }

    private static async Task<(Guid DeviceId, Guid RawEventId)> SeedSkewedHistoryAsync(AppDbContext db)
    {
        var employee = AddEmployee(db);
        var device = new BiometricDevice { Name = "ADMS-SN1", SerialNumber = "SN1" };
        db.BiometricDevices.Add(device);
        var raw = new BiometricRawEvent
        {
            DeviceId = device.Id,
            ReceivedAtUtc = new DateTime(2026, 9, 15, 13, 10, 0),
            Payload = Payload,
            ParseStatus = "Parsed",
        };
        db.BiometricRawEvents.Add(raw);
        db.BiometricPunchEvents.Add(Punch(device.Id, raw.Id, SkewedIn));
        db.BiometricPunchEvents.Add(Punch(device.Id, raw.Id, SkewedOut));

        db.AttendanceRecords.Add(new AttendanceRecord
        {
            EmployeeId = employee.Id,
            Date = SkewedIn.Date,
            PunchIn = SkewedIn,
            Status = "Present",
            Source = "Biometric",
        });
        db.AttendanceRecords.Add(new AttendanceRecord
        {
            EmployeeId = employee.Id,
            Date = SkewedOut.Date,
            PunchIn = SkewedOut,
            Status = "Present",
            Source = "Biometric",
        });

        await db.SaveChangesAsync();
        return (device.Id, raw.Id);
    }

    private static BiometricPunchEvent Punch(Guid deviceId, Guid rawEventId, DateTime at) => new()
    {
        DeviceId = deviceId,
        RawEventId = rawEventId,
        DeviceUserId = "689",
        PunchAtUtc = at,
        DedupeHash = AdmsPayloadParser.ComputeDedupe(deviceId, "689", at, null, null, null),
        ProcessedToAttendance = true,
    };

    private static Employee AddEmployee(AppDbContext db)
    {
        var employee = new Employee
        {
            EmployeeCode = "689",
            FirstName = "Rasika",
            LastName = "Vincent",
            DateOfBirth = new DateTime(1990, 1, 1),
            JoinDate = new DateTime(2020, 1, 1),
            DepartmentId = Guid.NewGuid(),
        };
        db.Employees.Add(employee);
        return employee;
    }

    private static BiometricPunchTimeRepairService CreateRepair(AppDbContext db, BusinessClock clock) =>
        new(db, new BiometricService(db), clock, NullLogger<BiometricPunchTimeRepairService>.Instance);

    private static AppDbContext CreateDb(out BusinessClock clock)
    {
        clock = new BusinessClock(new ConfigurationBuilder().Build());
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options, clock);
    }
}
