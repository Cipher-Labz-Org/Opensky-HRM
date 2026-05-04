using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/biometric/adms")]
public class BiometricAdmsController : ControllerBase
{
    private static readonly TimeZoneInfo AdmsSourceTimeZone = ResolveAdmsSourceTimeZone();
    private readonly AppDbContext _db;
    private readonly ILogger<BiometricAdmsController> _logger;
    private readonly IConfiguration _configuration;

    public BiometricAdmsController(
        AppDbContext db,
        ILogger<BiometricAdmsController> logger,
        IConfiguration configuration)
    {
        _db = db;
        _logger = logger;
        _configuration = configuration;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public IActionResult Health() => Ok(new { ok = true, service = "adms", utc = DateTime.UtcNow });

    /// <summary>
    /// Quick DB-side check that ADMS payloads and parsed punches landed (requires shared secret — set BiometricAdms:DiagnosticSecret).
    /// </summary>
    [AllowAnonymous]
    [HttpGet("ingestion-summary")]
    public async Task<IActionResult> IngestionSummary(
        [FromHeader(Name = "X-Adms-Diagnostic")] string? key,
        CancellationToken cancellationToken = default)
    {
        var expected = _configuration["BiometricAdms:DiagnosticSecret"];
        if (string.IsNullOrWhiteSpace(expected))
            return NotFound();
        if (!string.Equals((key ?? "").Trim(), expected.Trim(), StringComparison.Ordinal))
            return Unauthorized();

        var now = DateTime.UtcNow;
        var since24 = now.AddHours(-24);
        var since48 = now.AddHours(-48);

        var raw24 = await _db.BiometricRawEvents.AsNoTracking()
            .CountAsync(x => x.ReceivedAtUtc >= since24, cancellationToken);
        var parseFail48 = await _db.BiometricRawEvents.AsNoTracking()
            .CountAsync(x => x.ReceivedAtUtc >= since48 && x.ParseStatus == "Failed", cancellationToken);
        var punch24 = await _db.BiometricPunchEvents.AsNoTracking()
            .CountAsync(x => x.CreatedAt >= since24, cancellationToken);
        var punchUnprocessed = await _db.BiometricPunchEvents.AsNoTracking()
            .CountAsync(x => !x.ProcessedToAttendance, cancellationToken);

        var latestRawUtc = await _db.BiometricRawEvents.AsNoTracking()
            .OrderByDescending(x => x.ReceivedAtUtc).Select(x => x.ReceivedAtUtc).FirstOrDefaultAsync(cancellationToken);
        var latestPunchUtc = await _db.BiometricPunchEvents.AsNoTracking()
            .OrderByDescending(x => x.PunchAtUtc).Select(x => x.PunchAtUtc).FirstOrDefaultAsync(cancellationToken);

        var attendanceAdmsRecent = await _db.AttendanceRecords.AsNoTracking()
            .Where(a => a.Source == "Biometric-ADMS" && a.Date >= DateTime.UtcNow.Date.AddDays(-7))
            .CountAsync(cancellationToken);

        return Ok(new
        {
            utc = now,
            rawEventsLast24h = raw24,
            parseFailedEventsLast48h = parseFail48,
            punchEventsInsertedLast24h = punch24,
            punchEventsNotProcessedToAttendance = punchUnprocessed,
            latestRawReceivedUtc = latestRawUtc == default ? (DateTime?)null : latestRawUtc,
            latestPunchStoredAtUtcApprox = latestPunchUtc == default ? (DateTime?)null : latestPunchUtc,
            attendanceRecordsBiometricAdmsLast7Days = attendanceAdmsRecent,
        });
    }

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
            // Many terminals POST logs without SN/serial; we still need a device row for punch dedupe FK.
            if (device is null && parsed.Count > 0)
                device = await ResolveDeviceAsync("__ADMS_NO_SERIAL__", cancellationToken);
            if (device is not null && rawEvent.DeviceId is null)
            {
                rawEvent.DeviceId = device.Id;
                await _db.SaveChangesAsync(cancellationToken);
            }

            if (parsed.Count > 0 && device is not null)
            {
                var insertedEvents = new List<BiometricPunchEvent>();
                foreach (var item in parsed)
                {
                    var dedupe = ComputeDedupe(device.Id, item.UserId, item.PunchAtUtc, item.PunchState, item.VerifyMode, item.ExternalLogId);
                    var exists = await _db.BiometricPunchEvents.AsNoTracking()
                        .AnyAsync(x => x.DedupeHash == dedupe, cancellationToken);
                    if (exists) continue;

                    var punchEvent = new BiometricPunchEvent
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
                    };
                    _db.BiometricPunchEvents.Add(punchEvent);
                    insertedEvents.Add(punchEvent);
                }

                if (insertedEvents.Count > 0)
                {
                    await _db.SaveChangesAsync(cancellationToken);
                    await ProcessPunchesToAttendanceAsync(insertedEvents, cancellationToken);
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

        var jsonSerial = TryExtractDeviceSerialFromJson(payload);
        if (!string.IsNullOrWhiteSpace(jsonSerial))
            return jsonSerial;

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

    private static string? TryExtractDeviceSerialFromJson(string payload)
    {
        if (string.IsNullOrWhiteSpace(payload))
            return null;

        var trimmed = payload.Trim();
        if (!trimmed.StartsWith("{") && !trimmed.StartsWith("["))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(trimmed);
            if (doc.RootElement.ValueKind == JsonValueKind.Object)
                return ReadJson(doc.RootElement, "deviceId", "deviceid", "device", "sn", "serial", "terminalSn", "terminal_sn");

            if (doc.RootElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in doc.RootElement.EnumerateArray())
                {
                    if (item.ValueKind != JsonValueKind.Object) continue;
                    var serial = ReadJson(item, "deviceId", "deviceid", "device", "sn", "serial", "terminalSn", "terminal_sn");
                    if (!string.IsNullOrWhiteSpace(serial))
                        return serial;
                }
            }
        }
        catch
        {
            // Non-fatal; fallback to legacy marker parsing.
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
        var userId = ReadJson(item, "userId", "userid", "pin", "employeeCode", "empid", "employeeid");
        var punchAtText = ReadJson(item, "timestamp", "time", "checkTime", "punchTime", "alltime", "checktime", "atttime", "att_time");
        if (string.IsNullOrWhiteSpace(userId) || !TryParseUtc(punchAtText, out var punchAt))
            return false;

        mapped = new ParsedPunch(
            userId.Trim(),
            punchAt,
            ReadJson(item, "punchState", "status", "state", "checkingstatus", "checkstatus"),
            ReadJson(item, "verifyMode", "verify", "verifytype"),
            ReadJson(item, "id", "logId", "recordid", "transactionid"));
        return true;
    }

    private static string? ReadJson(JsonElement item, params string[] keys)
    {
        Dictionary<string, JsonElement>? props = null;
        if (item.ValueKind == JsonValueKind.Object)
        {
            props = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in item.EnumerateObject())
            {
                if (!props.ContainsKey(p.Name))
                    props[p.Name] = p.Value;
            }
        }

        foreach (var key in keys)
        {
            if (props is null || !props.TryGetValue(key, out var val)) continue;
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

        // Attendance tables in this app persist business-local wall-clock times.
        // ADMS timestamps are usually local times; preserve that local wall-clock time.
        if (!DateTime.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var dt))
            return false;

        if (dt.Kind == DateTimeKind.Utc)
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(dt, AdmsSourceTimeZone);
            utc = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
            return true;
        }

        if (dt.Kind == DateTimeKind.Local)
        {
            utc = DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
            return true;
        }

        utc = DateTime.SpecifyKind(dt, DateTimeKind.Unspecified);
        return true;
    }

    private static TimeZoneInfo ResolveAdmsSourceTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Asia/Colombo");
        }
        catch
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Sri Lanka Standard Time");
            }
            catch
            {
                return TimeZoneInfo.Utc;
            }
        }
    }

    private static string ComputeDedupe(Guid deviceId, string userId, DateTime punchAtUtc, string? punchState, string? verifyMode, string? externalLogId)
    {
        var source = $"{deviceId:N}|{userId}|{punchAtUtc:O}|{punchState}|{verifyMode}|{externalLogId}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(source));
        return Convert.ToHexString(bytes);
    }

    private async Task ProcessPunchesToAttendanceAsync(List<BiometricPunchEvent> punchEvents, CancellationToken cancellationToken)
    {
        var employeeCodes = punchEvents
            .Select(x => x.DeviceUserId?.Trim() ?? "")
            .Where(x => x.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (employeeCodes.Count == 0) return;

        var employees = new Dictionary<string, Employee>(StringComparer.OrdinalIgnoreCase);
        foreach (var code in employeeCodes)
        {
            var resolved = await ResolveEmployeeByBiometricUserIdAsync(code, cancellationToken);
            if (resolved is not null)
                employees[code] = resolved;
            else
                _logger.LogInformation("ADMS punch ignored; no employee matched device user id {DeviceUserId}", code);
        }

        foreach (var punch in punchEvents.OrderBy(x => x.PunchAtUtc))
        {
            var key = punch.DeviceUserId?.Trim() ?? "";
            if (string.IsNullOrEmpty(key) || !employees.TryGetValue(key, out var employee))
                continue;

            var punchDate = punch.PunchAtUtc.Date;
            var source = "Biometric-ADMS";

            var existingOpen = await _db.AttendanceRecords
                .Where(a => a.EmployeeId == employee.Id && a.Date == punchDate && a.PunchOut == null)
                .OrderByDescending(a => a.PunchIn)
                .FirstOrDefaultAsync(cancellationToken);
            var isOut = IsPunchOut(punch.PunchState) || (IsAmbiguousAdmsState(punch.PunchState) && existingOpen is not null);

            if (isOut && existingOpen is not null)
            {
                var punchIn = existingOpen.PunchIn ?? punch.PunchAtUtc;
                if (punch.PunchAtUtc >= punchIn)
                {
                    existingOpen.PunchOut = punch.PunchAtUtc;
                    existingOpen.WorkedHours = Math.Round((decimal)(punch.PunchAtUtc - punchIn).TotalHours, 2);
                    existingOpen.Source = source;
                }
                else
                {
                    _db.AttendanceRecords.Add(new AttendanceRecord
                    {
                        EmployeeId = employee.Id,
                        Date = punchDate,
                        PunchOut = punch.PunchAtUtc,
                        Status = "Present",
                        Source = source
                    });
                }
            }
            else if (!isOut)
            {
                var duplicateIn = await _db.AttendanceRecords
                    .AnyAsync(a => a.EmployeeId == employee.Id
                        && a.Date == punchDate
                        && a.PunchIn == punch.PunchAtUtc
                        && a.Source == source, cancellationToken);
                if (duplicateIn)
                {
                    punch.ProcessedToAttendance = true;
                    continue;
                }

                _db.AttendanceRecords.Add(new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    Date = punchDate,
                    PunchIn = punch.PunchAtUtc,
                    Status = "Present",
                    Source = source
                });
            }
            else
            {
                _db.AttendanceRecords.Add(new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    Date = punchDate,
                    PunchOut = punch.PunchAtUtc,
                    Status = "Present",
                    Source = source
                });
            }

            punch.ProcessedToAttendance = true;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Terminals usually send PIN / numeric ids; HR master data often uses EMP-00xxxx codes.
    /// Try exact <see cref="Employee.EmployeeCode"/> first, then a digit-tail match against stored codes.
    /// </summary>
    private async Task<Employee?> ResolveEmployeeByBiometricUserIdAsync(string rawUserId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(rawUserId)) return null;

        var t = rawUserId.Trim();
        var exact = await _db.Employees.FirstOrDefaultAsync(e => e.EmployeeCode == t, cancellationToken);
        if (exact is not null) return exact;

        var digits = new string(t.Where(char.IsDigit).ToArray());
        if (digits.Length < 3) return null;

        // Narrow in SQL using Contains, then refine in-memory (digits-only tail vs full formatted code).
        var candidates = await _db.Employees
            .AsNoTracking()
            .Where(e => e.EmployeeCode != null && e.EmployeeCode.Contains(digits))
            .Take(40)
            .ToListAsync(cancellationToken);

        static string DigitsOnly(string? s)
            => string.IsNullOrEmpty(s) ? "" : new string(s.Where(char.IsDigit).ToArray());

        var filtered = candidates
            .Where(e =>
            {
                var n = DigitsOnly(e.EmployeeCode);
                return string.Equals(n, digits, StringComparison.Ordinal)
                       || (!string.IsNullOrEmpty(n) && n.EndsWith(digits, StringComparison.Ordinal));
            })
            .ToList();

        if (filtered.Count == 1) return filtered[0];
        if (filtered.Count > 1)
        {
            // Prefer the longest normalized code when multiple collide (ambiguous short PINs).
            return filtered.OrderByDescending(e => DigitsOnly(e.EmployeeCode).Length).First();
        }

        return null;
    }

    private static bool IsPunchOut(string? punchState)
    {
        if (string.IsNullOrWhiteSpace(punchState))
            return false;

        var state = punchState.Trim().ToLowerInvariant();
        if (state.Contains("out"))
            return true;

        return state is "1" or "3" or "5";
    }

    private static bool IsAmbiguousAdmsState(string? punchState)
    {
        if (string.IsNullOrWhiteSpace(punchState))
            return false;

        var state = punchState.Trim();
        return string.Equals(state, "255", StringComparison.OrdinalIgnoreCase);
    }

    private readonly record struct ParsedPunch(
        string UserId,
        DateTime PunchAtUtc,
        string? PunchState,
        string? VerifyMode,
        string? ExternalLogId);
}

