using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class BiometricAdmsIngestService
{
    private readonly AppDbContext _db;
    private readonly IBiometricService _biometricService;
    private readonly AdmsPayloadParser _parser;
    private readonly ILogger<BiometricAdmsIngestService> _logger;

    public BiometricAdmsIngestService(
        AppDbContext db,
        IBiometricService biometricService,
        IBusinessClock clock,
        ILogger<BiometricAdmsIngestService> logger)
    {
        _db = db;
        _biometricService = biometricService;
        _parser = new AdmsPayloadParser(clock);
        _logger = logger;
    }

    public async Task IngestAsync(
        string rawBody,
        string? deviceSerial,
        string? sourceIp,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        var serial = NormalizeSerial(deviceSerial) ?? AdmsPayloadParser.ExtractSerialFromPayload(rawBody);
        var device = await ResolveDeviceAsync(serial, cancellationToken);
        if (device is not null)
        {
            device.LastSyncAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        var rawEvent = new BiometricRawEvent
        {
            DeviceId = device?.Id,
            EventType = eventType,
            ReceivedAtUtc = DateTime.UtcNow,
            Payload = string.IsNullOrWhiteSpace(rawBody) ? "(empty)" : rawBody,
            SourceIp = sourceIp,
            ParseStatus = "Pending",
        };

        _db.BiometricRawEvents.Add(rawEvent);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "ADMS ingest from {SourceIp} serial={Serial} bytes={Length} event={EventType}",
            sourceIp ?? "?",
            serial ?? "(none)",
            rawBody?.Length ?? 0,
            eventType);

        try
        {
            var parsed = _parser.ParsePunches(rawBody ?? string.Empty).ToList();
            if (parsed.Count == 0)
            {
                rawEvent.ParseStatus = string.IsNullOrWhiteSpace(rawBody) ? "Empty" : "NoPunches";
                rawEvent.ParseError = device is null ? "Missing device serial (SN)" : null;
            }
            else if (device is null)
            {
                rawEvent.ParseStatus = "NoDevice";
                rawEvent.ParseError = "Punches parsed but device serial (SN) is missing from request";
            }
            else
            {
                var corrections = await DeviceClockCorrections.LoadAsync(_db, cancellationToken);
                foreach (var item in parsed)
                {
                    var punchAt = DeviceClockCorrections.Apply(corrections, device.Id, rawEvent.ReceivedAtUtc, item.PunchAtUtc);
                    var dedupe = AdmsPayloadParser.ComputeDedupe(device.Id, item.UserId, punchAt, item.PunchState, item.VerifyMode, item.ExternalLogId);
                    var exists = await _db.BiometricPunchEvents.AsNoTracking()
                        .AnyAsync(x => x.DedupeHash == dedupe, cancellationToken);
                    if (exists) continue;

                    _db.BiometricPunchEvents.Add(new BiometricPunchEvent
                    {
                        DeviceId = device.Id,
                        RawEventId = rawEvent.Id,
                        DeviceUserId = item.UserId.Trim(),
                        PunchAtUtc = punchAt,
                        PunchState = item.PunchState,
                        VerifyMode = item.VerifyMode,
                        ExternalLogId = item.ExternalLogId,
                        DedupeHash = dedupe,
                        ProcessedToAttendance = false,
                    });
                }

                rawEvent.ParseStatus = "Parsed";
                rawEvent.ParseError = null;
            }

            await _db.SaveChangesAsync(cancellationToken);
            await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 20, cancellationToken);
        }
        catch (Exception ex)
        {
            rawEvent.ParseStatus = "Failed";
            rawEvent.ParseError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogWarning(ex, "ADMS ingest parse failed");
        }
    }

    private static string? NormalizeSerial(string? serial) =>
        string.IsNullOrWhiteSpace(serial) ? null : serial.Trim();

    public async Task TouchDeviceAsync(string? deviceSerial, CancellationToken cancellationToken = default)
    {
        var serial = NormalizeSerial(deviceSerial);
        if (serial is null) return;

        var device = await _db.BiometricDevices.FirstOrDefaultAsync(x => x.SerialNumber == serial, cancellationToken);
        if (device is null) return;

        device.LastSyncAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<BiometricDevice?> ResolveDeviceAsync(string? serialNumber, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(serialNumber))
            return null;

        var existing = await _db.BiometricDevices
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.SerialNumber == serialNumber, cancellationToken);
        if (existing is not null)
        {
            existing.IsDeleted = false;
            existing.LastSyncAt = DateTime.UtcNow;
            return existing;
        }

        var created = new BiometricDevice
        {
            Name = $"ADMS-{serialNumber}",
            SerialNumber = serialNumber,
            DeviceType = "Fingerprint",
            IsActive = true,
            LastSyncAt = DateTime.UtcNow,
        };

        _db.BiometricDevices.Add(created);
        await _db.SaveChangesAsync(cancellationToken);
        return created;
    }

    public async Task<int> ReplayFailedRawEventsAsync(CancellationToken cancellationToken = default)
    {
        var failed = await _db.BiometricRawEvents
            .Where(x => x.ParseStatus == "NoPunches" || x.ParseStatus == "Failed" || x.ParseStatus == "NoDevice")
            .OrderBy(x => x.ReceivedAtUtc)
            .ToListAsync(cancellationToken);

        var corrections = await DeviceClockCorrections.LoadAsync(_db, cancellationToken);
        var replayed = 0;
        foreach (var raw in failed)
        {
            var serial = AdmsPayloadParser.ExtractSerialFromPayload(raw.Payload);
            if (string.IsNullOrWhiteSpace(serial) && raw.DeviceId.HasValue)
            {
                var linked = await _db.BiometricDevices.FindAsync([raw.DeviceId.Value], cancellationToken);
                serial = linked?.SerialNumber;
            }

            var device = await ResolveDeviceAsync(serial, cancellationToken);
            if (device is not null)
            {
                device.LastSyncAt = DateTime.UtcNow;
                raw.DeviceId = device.Id;
            }

            var parsed = _parser.ParsePunches(raw.Payload ?? string.Empty).ToList();
            if (parsed.Count == 0)
            {
                raw.ParseStatus = "NoPunches";
                continue;
            }

            if (device is null)
            {
                raw.ParseStatus = "NoDevice";
                raw.ParseError = "Missing device serial in payload";
                continue;
            }

            foreach (var item in parsed)
            {
                var punchAt = DeviceClockCorrections.Apply(corrections, device.Id, raw.ReceivedAtUtc, item.PunchAtUtc);
                var dedupe = AdmsPayloadParser.ComputeDedupe(device.Id, item.UserId, punchAt, item.PunchState, item.VerifyMode, item.ExternalLogId);
                var exists = await _db.BiometricPunchEvents
                    .AnyAsync(x => x.DedupeHash == dedupe, cancellationToken);
                if (exists)
                {
                    await _db.BiometricPunchEvents
                        .Where(x => x.DedupeHash == dedupe)
                        .ExecuteUpdateAsync(s => s.SetProperty(p => p.ProcessedToAttendance, false), cancellationToken);
                    continue;
                }

                _db.BiometricPunchEvents.Add(new BiometricPunchEvent
                {
                    DeviceId = device.Id,
                    RawEventId = raw.Id,
                    DeviceUserId = item.UserId.Trim(),
                    PunchAtUtc = punchAt,
                    PunchState = item.PunchState,
                    VerifyMode = item.VerifyMode,
                    ExternalLogId = item.ExternalLogId,
                    DedupeHash = dedupe,
                    ProcessedToAttendance = false,
                });
            }

            raw.ParseStatus = "Parsed";
            raw.ParseError = null;
            replayed++;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 20, cancellationToken);
        return replayed;
    }
}
