using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
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
    private readonly IBusinessClock _clock;
    private readonly ILogger<BiometricAdmsIngestService> _logger;

    public BiometricAdmsIngestService(
        AppDbContext db,
        IBiometricService biometricService,
        IBusinessClock clock,
        ILogger<BiometricAdmsIngestService> logger)
    {
        _db = db;
        _biometricService = biometricService;
        _clock = clock;
        _logger = logger;
    }

    public async Task IngestAsync(
        string rawBody,
        string? deviceSerial,
        string? sourceIp,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        var serial = NormalizeSerial(deviceSerial) ?? ExtractSerialFromPayload(rawBody);
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
            var parsed = ParsePunches(rawBody ?? string.Empty).ToList();
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
                foreach (var item in parsed)
                {
                    var dedupe = ComputeDedupe(device.Id, item.UserId, item.PunchAtUtc, item.PunchState, item.VerifyMode, item.ExternalLogId);
                    var exists = await _db.BiometricPunchEvents.AsNoTracking()
                        .AnyAsync(x => x.DedupeHash == dedupe, cancellationToken);
                    if (exists) continue;

                    _db.BiometricPunchEvents.Add(new BiometricPunchEvent
                    {
                        DeviceId = device.Id,
                        RawEventId = rawEvent.Id,
                        DeviceUserId = item.UserId,
                        PunchAtUtc = item.PunchAtUtc,
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
            await _biometricService.ProcessAdmsPunchesToAttendanceAsync(cancellationToken);
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

    private IEnumerable<ParsedPunch> ParsePunches(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            yield break;

        var trimmed = payload.Trim();
        if (trimmed.Equals("ATTLOG", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("OPERLOG", StringComparison.OrdinalIgnoreCase))
            yield break;

        if (trimmed.StartsWith('{') || trimmed.StartsWith('['))
        {
            foreach (var p in ParseJson(trimmed))
                yield return p;
            yield break;
        }

        foreach (var line in trimmed.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (line.Contains('=') && TryParseKeyValueLine(line, out var kvPunch))
            {
                yield return kvPunch;
                continue;
            }

            var parts = line.Split('\t');
            if (parts.Length < 2) continue;

            var userId = parts[0].Trim();
            if (string.IsNullOrWhiteSpace(userId) || userId.Equals("PIN", StringComparison.OrdinalIgnoreCase))
                continue;
            if (!_clock.TryParseDeviceTimestamp(parts[1].Trim(), out var punchAt))
                continue;

            yield return new ParsedPunch(
                userId,
                punchAt,
                parts.ElementAtOrDefault(2)?.Trim(),
                parts.ElementAtOrDefault(3)?.Trim(),
                parts.ElementAtOrDefault(4)?.Trim());
        }
    }

    private bool TryParseKeyValueLine(string line, out ParsedPunch mapped)
    {
        mapped = default;
        var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var segment in line.Split(new[] { '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = segment.IndexOf('=');
            if (eq <= 0) continue;
            fields[segment[..eq].Trim()] = segment[(eq + 1)..].Trim();
        }

        if (fields.Count == 0) return false;

        var userId = FirstField(fields, "PIN", "UserId", "userid", "user_id", "employeeCode");
        var punchAtText = FirstField(fields, "DateTime", "timestamp", "time", "checkTime", "punchTime");
        if (string.IsNullOrWhiteSpace(userId) || !_clock.TryParseDeviceTimestamp(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId,
            punchAt,
            FirstField(fields, "Status", "status", "state", "punchState"),
            FirstField(fields, "Verified", "verify", "verifyMode"),
            FirstField(fields, "WorkCode", "workcode", "id", "logId"));
        return true;
    }

    private static string? FirstField(IReadOnlyDictionary<string, string> fields, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (fields.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val))
                return val;
        }
        return null;
    }

    private static string? ExtractSerialFromPayload(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return null;

        var trimmed = payload.Trim();
        if (!trimmed.StartsWith('{') && !trimmed.StartsWith('['))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(payload);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    var serial = ReadJson(item, "DeviceID", "deviceId", "device_id", "sn", "SN", "serial", "serialNumber");
                    if (!string.IsNullOrWhiteSpace(serial))
                        return serial;
                }
                return null;
            }

            return ReadJson(doc.RootElement, "DeviceID", "deviceId", "device_id", "sn", "SN", "serial", "serialNumber");
        }
        catch
        {
            return null;
        }
    }

    public async Task<int> ReplayFailedRawEventsAsync(CancellationToken cancellationToken = default)
    {
        var failed = await _db.BiometricRawEvents
            .Where(x => x.ParseStatus == "NoPunches" || x.ParseStatus == "Failed" || x.ParseStatus == "NoDevice")
            .OrderBy(x => x.ReceivedAtUtc)
            .ToListAsync(cancellationToken);

        var replayed = 0;
        foreach (var raw in failed)
        {
            var serial = ExtractSerialFromPayload(raw.Payload);
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

            var parsed = ParsePunches(raw.Payload ?? string.Empty).ToList();
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
                var dedupe = ComputeDedupe(device.Id, item.UserId, item.PunchAtUtc, item.PunchState, item.VerifyMode, item.ExternalLogId);
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
                    DeviceUserId = item.UserId,
                    PunchAtUtc = item.PunchAtUtc,
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
        await _biometricService.ProcessAdmsPunchesToAttendanceAsync(cancellationToken);
        return replayed;
    }

    private IEnumerable<ParsedPunch> ParseJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in doc.RootElement.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
            yield break;
        }

        if (TryMapJsonItem(doc.RootElement, out var single))
            yield return single;

        if (doc.RootElement.TryGetProperty("logs", out var logs) && logs.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in logs.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
        }

        if (doc.RootElement.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in data.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
        }
    }

    private bool TryMapJsonItem(JsonElement item, out ParsedPunch mapped)
    {
        mapped = default;
        var userId = ReadJson(item, "EmpId", "empId", "userId", "userid", "user_id", "pin", "PIN", "employeeCode");
        var punchAtText = ReadJson(item, "AttTime", "attTime", "timestamp", "time", "checkTime", "punchTime", "DateTime", "datetime");
        if (string.IsNullOrWhiteSpace(userId) || !_clock.TryParseDeviceTimestamp(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId.Trim(),
            punchAt,
            ReadJson(item, "CheckingStatus", "checkingStatus", "punchState", "status", "state"),
            ReadJson(item, "VerifyType", "verifyType", "verifyMode", "verify"),
            ReadJson(item, "id", "logId"));
        return true;
    }

    private static string? ReadJson(JsonElement item, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (item.TryGetProperty(key, out var val))
                return GetJsonScalar(val);

            foreach (var prop in item.EnumerateObject())
            {
                if (!string.Equals(prop.Name, key, StringComparison.OrdinalIgnoreCase))
                    continue;
                return GetJsonScalar(prop.Value);
            }
        }
        return null;
    }

    private static string? GetJsonScalar(JsonElement val) =>
        val.ValueKind switch
        {
            JsonValueKind.String => val.GetString(),
            JsonValueKind.Number => val.GetRawText(),
            _ => null,
        };

    private static string ComputeDedupe(Guid deviceId, string userId, DateTime punchAtUtc, string? punchState, string? verifyMode, string? externalLogId)
    {
        var source = $"{deviceId:N}|{userId}|{punchAtUtc:O}|{punchState}|{verifyMode}|{externalLogId}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(source));
        return Convert.ToHexString(bytes);
    }

    private readonly record struct ParsedPunch(
        string UserId,
        DateTime PunchAtUtc,
        string? PunchState,
        string? VerifyMode,
        string? ExternalLogId);
}
