using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Re-reads every stored ADMS payload with the current parser and puts the saved
/// fingerprint taps back in line with it. Punches saved before the parser fix were
/// converted to the API server's timezone (12h30m behind Colombo on a Pacific host).
/// Affected attendance days are rebuilt from the corrected taps.
/// </summary>
public class BiometricPunchTimeRepairService
{
    public const string CompletedSettingKey = "biometric.punchTimesReparsedV1";
    public const string HoursRepairCursorKey = "biometric.workedHoursRepairedThrough";

    private const string RunningPrefix = "running:";
    private const int PageSize = 500;
    private const int MaxSamples = 50;

    private readonly AppDbContext _db;
    private readonly IBiometricService _biometricService;
    private readonly AdmsPayloadParser _parser;
    private readonly IBusinessClock _clock;
    private readonly ILogger<BiometricPunchTimeRepairService> _logger;

    public BiometricPunchTimeRepairService(
        AppDbContext db,
        IBiometricService biometricService,
        IBusinessClock clock,
        ILogger<BiometricPunchTimeRepairService> logger)
    {
        _db = db;
        _biometricService = biometricService;
        _parser = new AdmsPayloadParser(clock);
        _clock = clock;
        _logger = logger;
    }

    /// <param name="candidateCorrection">A device clock correction to try in addition to the saved ones (preview only).</param>
    public async Task<PunchTimeRepairReportDto> RunAsync(
        bool dryRun,
        CancellationToken cancellationToken = default,
        DeviceClockCorrectionDto? candidateCorrection = null)
    {
        var report = new PunchTimeRepairReportDto { DryRun = dryRun };
        var corrections = await DeviceClockCorrections.LoadAsync(_db, cancellationToken);
        if (candidateCorrection is not null)
            corrections.Add(candidateCorrection);
        var months = new SortedDictionary<string, PunchTimeRepairMonthDto>(StringComparer.Ordinal);

        var employees = await _db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted)
            .ToListAsync(cancellationToken);
        var lookup = BiometricEmployeeResolver.BuildLookup(employees);

        report.PunchesWithoutRawEvent = await _db.BiometricPunchEvents.AsNoTracking()
            .CountAsync(p => p.RawEventId == null, cancellationToken);

        // Hashes assigned so far in a dry run, where nothing is written back.
        var simulatedHashes = new HashSet<string>(StringComparer.Ordinal);

        for (var page = 0; ; page++)
        {
            var raws = await _db.BiometricRawEvents.AsNoTracking()
                .Where(r => r.ParseStatus == "Parsed" && r.DeviceId != null)
                .OrderBy(r => r.ReceivedAtUtc)
                .ThenBy(r => r.Id)
                .Skip(page * PageSize)
                .Take(PageSize)
                .Select(r => new { r.Id, DeviceId = r.DeviceId!.Value, r.ReceivedAtUtc, r.Payload })
                .ToListAsync(cancellationToken);
            if (raws.Count == 0)
                break;

            report.RawEventsScanned += raws.Count;

            var rawIds = raws.Select(r => (Guid?)r.Id).ToList();
            var storedRows = await _db.BiometricPunchEvents
                .Where(p => rawIds.Contains(p.RawEventId))
                .ToListAsync(cancellationToken);
            var rowsByRaw = storedRows.ToLookup(p => p.RawEventId!.Value);

            var parsedByRaw = new Dictionary<Guid, List<(AdmsPayloadParser.ParsedPunch Item, string Hash)>>();
            foreach (var raw in raws)
            {
                try
                {
                    parsedByRaw[raw.Id] = _parser.ParsePunches(raw.Payload)
                        .Select(item => item with
                        {
                            PunchAtUtc = DeviceClockCorrections.Apply(corrections, raw.DeviceId, raw.ReceivedAtUtc, item.PunchAtUtc),
                        })
                        .Select(item => (item, AdmsPayloadParser.ComputeDedupe(
                            raw.DeviceId, item.UserId.Trim(), item.PunchAtUtc, item.PunchState, item.VerifyMode, item.ExternalLogId)))
                        .ToList();
                }
                catch (Exception ex)
                {
                    report.RawEventsUnreadable++;
                    _logger.LogWarning(ex, "Punch time repair could not read raw ADMS event {RawEventId}", raw.Id);
                }
            }

            var candidateHashes = parsedByRaw.Values.SelectMany(v => v.Select(x => x.Hash)).Distinct().ToList();
            var knownHashes = (await _db.BiometricPunchEvents.AsNoTracking()
                    .Where(p => candidateHashes.Contains(p.DedupeHash))
                    .Select(p => p.DedupeHash)
                    .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.Ordinal);
            knownHashes.UnionWith(simulatedHashes);

            var affectedDays = new HashSet<(string DeviceUserId, DateTime Day)>();
            var toRemove = new List<BiometricPunchEvent>();
            var toCorrect = new List<(BiometricPunchEvent Row, DateTime Time, string Hash)>();
            var toInsert = new List<BiometricPunchEvent>();

            foreach (var raw in raws)
            {
                if (!parsedByRaw.TryGetValue(raw.Id, out var expected))
                    continue;

                var rows = rowsByRaw[raw.Id].ToList();
                var expectedHashes = expected.Select(x => x.Hash).ToHashSet(StringComparer.Ordinal);
                var storedHashes = rows.Select(r => r.DedupeHash).ToHashSet(StringComparer.Ordinal);

                report.PunchesUnchanged += rows.Count(r => expectedHashes.Contains(r.DedupeHash));

                var staleByKey = rows
                    .Where(r => !expectedHashes.Contains(r.DedupeHash))
                    .OrderBy(r => r.PunchAtUtc)
                    .GroupBy(r => MatchKey(r.DeviceUserId, r.PunchState, r.VerifyMode, r.ExternalLogId))
                    .ToDictionary(g => g.Key, g => new Queue<BiometricPunchEvent>(g));

                foreach (var (item, hash) in expected.OrderBy(x => x.Item.PunchAtUtc))
                {
                    if (storedHashes.Contains(hash))
                        continue;

                    var userId = item.UserId.Trim();
                    var key = MatchKey(userId, item.PunchState, item.VerifyMode, item.ExternalLogId);
                    BiometricPunchEvent? stale = null;
                    if (staleByKey.TryGetValue(key, out var queue) && queue.Count > 0)
                        stale = queue.Dequeue();

                    if (stale is not null)
                    {
                        affectedDays.Add((stale.DeviceUserId, stale.PunchAtUtc.Date));
                        affectedDays.Add((userId, item.PunchAtUtc.Date));
                        var oldTime = stale.PunchAtUtc;

                        if (knownHashes.Contains(hash))
                        {
                            toRemove.Add(stale);
                            report.DuplicatesRemoved++;
                            Month(months, item.PunchAtUtc).DuplicatesRemoved++;
                            AddSample(report, lookup, userId, oldTime, item.PunchAtUtc, "Duplicate removed");
                        }
                        else
                        {
                            toCorrect.Add((stale, item.PunchAtUtc, hash));
                            knownHashes.Add(hash);
                            simulatedHashes.Add(hash);
                            report.PunchesCorrected++;
                            Month(months, item.PunchAtUtc).Corrected++;
                            AddSample(report, lookup, userId, oldTime, item.PunchAtUtc, "Time corrected");
                        }

                        continue;
                    }

                    if (knownHashes.Contains(hash))
                        continue;

                    toInsert.Add(new BiometricPunchEvent
                    {
                        DeviceId = raw.DeviceId,
                        RawEventId = raw.Id,
                        DeviceUserId = userId,
                        PunchAtUtc = item.PunchAtUtc,
                        PunchState = item.PunchState,
                        VerifyMode = item.VerifyMode,
                        ExternalLogId = item.ExternalLogId,
                        DedupeHash = hash,
                        ProcessedToAttendance = true,
                    });
                    knownHashes.Add(hash);
                    simulatedHashes.Add(hash);
                    affectedDays.Add((userId, item.PunchAtUtc.Date));
                    report.PunchesInserted++;
                    Month(months, item.PunchAtUtc).Inserted++;
                    AddSample(report, lookup, userId, null, item.PunchAtUtc, "Missing punch added");
                }

                report.PunchesNotInPayload += staleByKey.Values.Sum(q => q.Count);
            }

            if (!dryRun && (toRemove.Count > 0 || toCorrect.Count > 0 || toInsert.Count > 0))
            {
                // Duplicates go first so a corrected hash never collides with a row still being deleted.
                if (toRemove.Count > 0)
                {
                    _db.BiometricPunchEvents.RemoveRange(toRemove);
                    await _db.SaveChangesAsync(cancellationToken);
                }

                foreach (var (row, time, hash) in toCorrect)
                {
                    row.PunchAtUtc = time;
                    row.DedupeHash = hash;
                    row.ProcessedToAttendance = true;
                }
                _db.BiometricPunchEvents.AddRange(toInsert);
                await _db.SaveChangesAsync(cancellationToken);

                await RebuildAffectedDaysAsync(affectedDays, lookup, report, cancellationToken);
            }

            _db.ChangeTracker.Clear();
        }

        report.ByMonth = months.Values.ToList();
        return report;
    }

    /// <summary>
    /// Compares each tap time in the stored payloads with when the payload reached the server.
    /// Live taps arrive within minutes, so a steady gap of hours on a device means its clock was wrong.
    /// </summary>
    public async Task<ClockDiagnosticsDto> ClockDiagnosticsAsync(
        DateTime receivedFromUtc,
        DateTime receivedToUtc,
        string? deviceUserId,
        CancellationToken cancellationToken = default)
    {
        var result = new ClockDiagnosticsDto();
        var serials = await _db.BiometricDevices.AsNoTracking()
            .IgnoreQueryFilters()
            .ToDictionaryAsync(d => d.Id, d => d.SerialNumber, cancellationToken);
        var lags = new Dictionary<(string Serial, string Day), List<int>>();
        var userFilter = deviceUserId?.Trim();

        for (var page = 0; ; page++)
        {
            var raws = await _db.BiometricRawEvents.AsNoTracking()
                .Where(r => r.ParseStatus == "Parsed" && r.DeviceId != null
                    && r.ReceivedAtUtc >= receivedFromUtc && r.ReceivedAtUtc < receivedToUtc)
                .OrderBy(r => r.ReceivedAtUtc)
                .ThenBy(r => r.Id)
                .Skip(page * PageSize)
                .Take(PageSize)
                .Select(r => new { DeviceId = r.DeviceId!.Value, r.ReceivedAtUtc, r.Payload })
                .ToListAsync(cancellationToken);
            if (raws.Count == 0)
                break;

            result.RawEventsScanned += raws.Count;
            foreach (var raw in raws)
            {
                var serial = serials.GetValueOrDefault(raw.DeviceId) ?? raw.DeviceId.ToString();
                var receivedLocal = _clock.ToBusinessLocal(DateTime.SpecifyKind(raw.ReceivedAtUtc, DateTimeKind.Utc));
                List<AdmsPayloadParser.ParsedPunch> punches;
                try
                {
                    punches = _parser.ParsePunches(raw.Payload).ToList();
                }
                catch
                {
                    continue;
                }

                foreach (var punch in punches)
                {
                    var lag = (int)Math.Round((receivedLocal - punch.PunchAtUtc).TotalMinutes);
                    var key = (serial, receivedLocal.ToString("yyyy-MM-dd"));
                    if (!lags.TryGetValue(key, out var list))
                    {
                        list = new List<int>();
                        lags[key] = list;
                    }
                    list.Add(lag);

                    if (userFilter is not null
                        && string.Equals(punch.UserId.Trim(), userFilter, StringComparison.OrdinalIgnoreCase)
                        && result.Punches.Count < 1000)
                    {
                        result.Punches.Add(new ClockDiagnosticPunchDto
                        {
                            DeviceSerial = serial,
                            DeviceUserId = punch.UserId.Trim(),
                            PunchTime = punch.PunchAtUtc,
                            ReceivedAtLocal = receivedLocal,
                            LagMinutes = lag,
                        });
                    }
                }
            }
        }

        foreach (var ((serial, day), list) in lags.OrderBy(k => k.Key.Day).ThenBy(k => k.Key.Serial))
        {
            list.Sort();
            result.Days.Add(new ClockDiagnosticDayDto
            {
                DeviceSerial = serial,
                ReceivedDate = day,
                Punches = list.Count,
                LivePunches = list.Count(l => Math.Abs(l) <= 30),
                MedianLagMinutes = list[list.Count / 2],
                TopLagBuckets = string.Join(", ", list
                    .GroupBy(l => (int)Math.Round(l / 30.0) * 30)
                    .OrderByDescending(g => g.Count())
                    .Take(3)
                    .Select(g => $"{g.Key}m x{g.Count()}")),
            });
        }

        return result;
    }

    /// <summary>Saves a device clock correction. Run <see cref="RunAsync"/> afterwards to apply it.</summary>
    public async Task SaveCorrectionAsync(DeviceClockCorrectionDto correction, CancellationToken cancellationToken = default)
    {
        correction.SavedAtUtc = DateTime.UtcNow;
        await DeviceClockCorrections.AddAsync(_db, correction, cancellationToken);
    }

    public Task<List<DeviceClockCorrectionDto>> GetCorrectionsAsync(CancellationToken cancellationToken = default) =>
        DeviceClockCorrections.LoadAsync(_db, cancellationToken);

    /// <summary>
    /// Runs the repair once per database. Afterwards the hours repair restarts from the
    /// earliest tap so every day is recalculated from the corrected punches.
    /// </summary>
    public async Task<PunchTimeRepairReportDto?> RunOnceAsync(CancellationToken cancellationToken = default)
    {
        var marker = await _db.SystemSettings
            .FirstOrDefaultAsync(s => s.Key == CompletedSettingKey, cancellationToken);
        if (marker is not null && !IsAbandonedRun(marker.Value))
            return null;

        // The processor job fires every two minutes; the running marker keeps a second copy out.
        if (marker is null)
        {
            marker = new SystemSetting
            {
                Key = CompletedSettingKey,
                Description = "Fingerprint punch times were re-read from the stored ADMS payloads and attendance rebuilt.",
            };
            _db.SystemSettings.Add(marker);
        }
        marker.Value = RunningPrefix + DateTime.UtcNow.ToString("O");
        await _db.SaveChangesAsync(cancellationToken);

        var report = await RunAsync(dryRun: false, cancellationToken);

        var cursor = await _db.SystemSettings
            .FirstOrDefaultAsync(s => s.Key == HoursRepairCursorKey, cancellationToken);
        if (cursor is not null)
            _db.SystemSettings.Remove(cursor);

        marker = await _db.SystemSettings.FirstAsync(s => s.Key == CompletedSettingKey, cancellationToken);
        marker.Value = $"{DateTime.UtcNow:O} corrected={report.PunchesCorrected} duplicates={report.DuplicatesRemoved} inserted={report.PunchesInserted} days={report.AttendanceDaysRebuilt}";
        await _db.SaveChangesAsync(cancellationToken);
        return report;
    }

    private async Task RebuildAffectedDaysAsync(
        HashSet<(string DeviceUserId, DateTime Day)> affectedDays,
        IReadOnlyDictionary<string, Employee> lookup,
        PunchTimeRepairReportDto report,
        CancellationToken cancellationToken)
    {
        var byEmployee = new Dictionary<Guid, HashSet<DateTime>>();
        foreach (var (deviceUserId, day) in affectedDays)
        {
            if (!BiometricEmployeeResolver.TryResolve(lookup, deviceUserId, out var employee))
                continue;
            if (!byEmployee.TryGetValue(employee.Id, out var days))
            {
                days = new HashSet<DateTime>();
                byEmployee[employee.Id] = days;
            }
            days.Add(day);
        }

        foreach (var (employeeId, days) in byEmployee)
        {
            var result = await _biometricService.RebuildEmployeeDaysAsync(employeeId, days, cancellationToken);
            report.AttendanceDaysRebuilt += result.Rebuilt;
            report.ManualDaysSkipped += result.SkippedManualDays.Count;
        }
    }

    private static bool IsAbandonedRun(string? value)
    {
        if (value is null || !value.StartsWith(RunningPrefix, StringComparison.Ordinal))
            return false;

        return !DateTime.TryParse(value[RunningPrefix.Length..], null, System.Globalization.DateTimeStyles.RoundtripKind, out var startedUtc)
            || DateTime.UtcNow - startedUtc.ToUniversalTime() > TimeSpan.FromHours(2);
    }

    private static string MatchKey(string deviceUserId, string? punchState, string? verifyMode, string? externalLogId) =>
        $"{deviceUserId.Trim()}|{punchState}|{verifyMode}|{externalLogId}";

    private static PunchTimeRepairMonthDto Month(SortedDictionary<string, PunchTimeRepairMonthDto> months, DateTime time)
    {
        var key = time.ToString("yyyy-MM");
        if (!months.TryGetValue(key, out var month))
        {
            month = new PunchTimeRepairMonthDto { Month = key };
            months[key] = month;
        }
        return month;
    }

    private static void AddSample(
        PunchTimeRepairReportDto report,
        IReadOnlyDictionary<string, Employee> lookup,
        string deviceUserId,
        DateTime? storedTime,
        DateTime correctTime,
        string action)
    {
        if (report.Samples.Count >= MaxSamples)
            return;

        BiometricEmployeeResolver.TryResolve(lookup, deviceUserId, out var employee);
        report.Samples.Add(new PunchTimeRepairSampleDto
        {
            DeviceUserId = deviceUserId,
            EmployeeCode = employee?.EmployeeCode,
            EmployeeName = employee is null ? null : $"{employee.FirstName} {employee.LastName}".Trim(),
            StoredTime = storedTime,
            CorrectTime = correctTime,
            Action = action,
        });
    }
}
