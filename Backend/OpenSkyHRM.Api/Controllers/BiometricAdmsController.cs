using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/biometric/adms")]
public class BiometricAdmsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<BiometricAdmsController> _logger;

    public BiometricAdmsController(AppDbContext db, ILogger<BiometricAdmsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { ok = true, service = "adms", utc = DateTime.UtcNow });

    [AllowAnonymous]
    [HttpGet("ping")]
    [HttpPost("ping")]
    public IActionResult Ping() => Content("OK");

    [AllowAnonymous]
    [HttpPost("logs")]
    public async Task<IActionResult> ReceiveLogs(CancellationToken cancellationToken)
    {
        var rawBody = await ReadRequestBodyAsync(cancellationToken);
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var serial = ExtractDeviceSerial(rawBody, Request.Query["sn"].ToString(), Request.Query["serial"].ToString());

        var device = await ResolveDeviceAsync(serial, cancellationToken);

        var rawEvent = new BiometricRawEvent
        {
            DeviceId = device?.Id,
            EventType = "logs",
            ReceivedAtUtc = DateTime.UtcNow,
            Payload = rawBody,
            SourceIp = sourceIp,
            ParseStatus = "Pending"
        };

        _db.BiometricRawEvents.Add(rawEvent);
        await _db.SaveChangesAsync(cancellationToken);

        try
        {
            var parsed = ParsePunches(rawBody).ToList();
            if (parsed.Count > 0 && device is not null)
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
                        ProcessedToAttendance = false
                    });
                }
            }

            rawEvent.ParseStatus = "Parsed";
            rawEvent.ParseError = null;
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            rawEvent.ParseStatus = "Failed";
            rawEvent.ParseError = ex.Message.Length > 1000 ? ex.Message[..1000] : ex.Message;
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogWarning(ex, "ADMS payload parse failed");
        }

        return Content("OK");
    }

    [Authorize]
    [HttpGet("recent/raw")]
    public async Task<IActionResult> GetRecentRawEvents([FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(take, 1, 100);
        var rows = await _db.BiometricRawEvents
            .AsNoTracking()
            .OrderByDescending(x => x.ReceivedAtUtc)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.DeviceId,
                x.EventType,
                x.ReceivedAtUtc,
                x.SourceIp,
                x.ParseStatus,
                x.ParseError
            })
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    [Authorize]
    [HttpGet("recent/punches")]
    public async Task<IActionResult> GetRecentPunchEvents([FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        var limit = Math.Clamp(take, 1, 100);
        var rows = await _db.BiometricPunchEvents
            .AsNoTracking()
            .OrderByDescending(x => x.PunchAtUtc)
            .Take(limit)
            .Select(x => new
            {
                x.Id,
                x.DeviceId,
                x.DeviceUserId,
                x.PunchAtUtc,
                x.PunchState,
                x.VerifyMode,
                x.ExternalLogId,
                x.ProcessedToAttendance,
                x.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    private async Task<string> ReadRequestBodyAsync(CancellationToken cancellationToken)
    {
        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync(cancellationToken);
            if (form.TryGetValue("table", out var table) && !string.IsNullOrWhiteSpace(table.ToString()))
                return table.ToString();
            if (form.TryGetValue("data", out var data) && !string.IsNullOrWhiteSpace(data.ToString()))
                return data.ToString();
            return string.Join("\n", form.Select(x => $"{x.Key}={x.Value}"));
        }

        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        return await reader.ReadToEndAsync();
    }

    private async Task<BiometricDevice?> ResolveDeviceAsync(string? serialNumber, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(serialNumber))
            return null;

        var normalized = serialNumber.Trim();
        var existing = await _db.BiometricDevices.FirstOrDefaultAsync(x => x.SerialNumber == normalized, cancellationToken);
        if (existing is not null) return existing;

        var created = new BiometricDevice
        {
            Name = $"ADMS-{normalized}",
            SerialNumber = normalized,
            DeviceType = "Fingerprint",
            IsActive = true,
            LastSyncAt = DateTime.UtcNow
        };

        _db.BiometricDevices.Add(created);
        await _db.SaveChangesAsync(cancellationToken);
        return created;
    }

    private static string? ExtractDeviceSerial(string payload, params string[] hints)
    {
        foreach (var hint in hints)
        {
            if (!string.IsNullOrWhiteSpace(hint)) return hint.Trim();
        }

        var markers = new[] { "sn=", "serial=", "device_sn=", "terminal_sn=" };
        var lower = payload.ToLowerInvariant();
        foreach (var marker in markers)
        {
            var idx = lower.IndexOf(marker, StringComparison.Ordinal);
            if (idx < 0) continue;
            var start = idx + marker.Length;
            var end = payload.IndexOfAny(new[] { '\n', '\r', '\t', ';', ',' }, start);
            if (end < 0) end = payload.Length;
            var value = payload[start..end].Trim();
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }

    private static IEnumerable<ParsedPunch> ParsePunches(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            yield break;

        var trimmed = payload.Trim();
        if (trimmed.StartsWith("{") || trimmed.StartsWith("["))
        {
            foreach (var p in ParseJson(trimmed))
                yield return p;
            yield break;
        }

        foreach (var line in payload.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Split('\t', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) continue;

            // Common ADMS style: userId<TAB>timestamp<TAB>punchState<TAB>verifyMode<TAB>logId
            var userId = parts[0].Trim();
            if (string.IsNullOrWhiteSpace(userId)) continue;
            if (!TryParseUtc(parts[1], out var punchAt)) continue;

            yield return new ParsedPunch(
                userId,
                punchAt,
                parts.ElementAtOrDefault(2)?.Trim(),
                parts.ElementAtOrDefault(3)?.Trim(),
                parts.ElementAtOrDefault(4)?.Trim());
        }
    }

    private static IEnumerable<ParsedPunch> ParseJson(string json)
    {
        using var doc = JsonDocument.Parse(json);
        if (doc.RootElement.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in doc.RootElement.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
            yield break;
        }

        if (doc.RootElement.TryGetProperty("logs", out var logs) && logs.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in logs.EnumerateArray())
                if (TryMapJsonItem(item, out var mapped))
                    yield return mapped;
        }
    }

    private static bool TryMapJsonItem(JsonElement item, out ParsedPunch mapped)
    {
        mapped = default;
        var userId = ReadJson(item, "userId", "userid", "pin", "employeeCode");
        var punchAtText = ReadJson(item, "timestamp", "time", "checkTime", "punchTime");
        if (string.IsNullOrWhiteSpace(userId) || !TryParseUtc(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId.Trim(),
            punchAt,
            ReadJson(item, "punchState", "status", "state"),
            ReadJson(item, "verifyMode", "verify"),
            ReadJson(item, "id", "logId"));
        return true;
    }

    private static string? ReadJson(JsonElement item, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (!item.TryGetProperty(key, out var val)) continue;
            return val.ValueKind switch
            {
                JsonValueKind.String => val.GetString(),
                JsonValueKind.Number => val.GetRawText(),
                _ => null
            };
        }
        return null;
    }

    private static bool TryParseUtc(string? input, out DateTime utc)
    {
        utc = default;
        if (string.IsNullOrWhiteSpace(input)) return false;

        if (!DateTime.TryParse(input, out var dt)) return false;
        utc = dt.Kind == DateTimeKind.Utc ? dt : DateTime.SpecifyKind(dt, DateTimeKind.Utc);
        return true;
    }

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

