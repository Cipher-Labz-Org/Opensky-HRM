using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/biometric/adms")]
public class BiometricAdmsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IBiometricService _biometricService;
    private readonly BiometricAdmsIngestService _ingest;

    public BiometricAdmsController(
        AppDbContext db,
        IBiometricService biometricService,
        BiometricAdmsIngestService ingest)
    {
        _db = db;
        _biometricService = biometricService;
        _ingest = ingest;
    }

    [AllowAnonymous]
    [HttpGet("health")]
    public async Task<IActionResult> HealthGet([FromQuery] string? SN, [FromQuery] string? sn, CancellationToken cancellationToken)
    {
        await _ingest.TouchDeviceAsync(FirstNonEmpty(SN, sn), cancellationToken);
        return Ok(new
        {
            ok = true,
            service = "adms",
            utc = DateTime.UtcNow,
            correctWebhookPath = "/api/biometric/adms/logs",
            note = "POST punch data to /logs not /health",
        });
    }

    /// <summary>Some ADMS installs POST to /health — accept and forward to ingest.</summary>
    [AllowAnonymous]
    [HttpPost("health")]
    public async Task<IActionResult> HealthPost(CancellationToken cancellationToken)
    {
        var rawBody = await ReadRequestBodyAsync(cancellationToken);
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var serial = FirstNonEmpty(
            Request.Query["SN"].ToString(),
            Request.Query["sn"].ToString(),
            Request.Query["serial"].ToString());

        await _ingest.IngestAsync(rawBody, serial, sourceIp, "health", cancellationToken);
        return Content("OK");
    }

    /// <summary>ADMS.lk connectivity test — use GET or POST; returns plain OK.</summary>
    [AllowAnonymous]
    [HttpGet("webhook")]
    public IActionResult WebhookGet() => Content("OK", "text/plain");

    [AllowAnonymous]
    [HttpGet("setup")]
    public IActionResult Setup()
    {
        var recommended = AdmsWebhookUrlHelper.RecommendWebhookUrl(Request.Host.Host, Request.Scheme);
        string? frontendWebhook = null;
        var host = Request.Host.Host.ToLowerInvariant();
        if (host.EndsWith("backend.openskyhrm.com"))
        {
            var slug = host[..host.IndexOf("backend.", StringComparison.Ordinal)];
            frontendWebhook = $"{Request.Scheme}://{slug}.openskyhrm.com/api/biometric/adms/logs";
        }

        return Ok(new
        {
            recommendedWebhookUrl = recommended,
            alternateFrontendWebhookUrl = frontendWebhook,
            webhookPath = "/api/biometric/adms/logs",
            deviceUserIds = "Must match employee Fingerprint ID when set, otherwise Employee Code (numeric PINs like 123 match EMP-0000123)",
            deviceSerials = "ADMS must send SN query param or DeviceID in JSON (e.g. NYU7253000136)",
            productionNote = "For *.openskyhrm.com tenants, prefer https://{tenant}backend.openskyhrm.com/api/biometric/adms/logs",
            localDevSteps = new[]
            {
                "Run: npx localtunnel --port 5000  (or ngrok http 5000)",
                "In app.adms.lk → Webhook URL paste: https://xxxx/api/biometric/adms/logs",
                "Save, punch on device, then Time & Attendance → Devices → Reprocess 30 days",
            },
            lanDeviceUrl = "http://YOUR-PC-WIFI-IP:5000/iclock/cdata",
        });
    }

    [AllowAnonymous]
    [HttpGet("ping")]
    [HttpPost("ping")]
    public IActionResult Ping() => Content("OK");

    [AllowAnonymous]
    [HttpGet("logs")]
    [HttpPost("logs")]
    [HttpPost("webhook")]
    public async Task<IActionResult> ReceiveLogs(CancellationToken cancellationToken)
    {
        var rawBody = await ReadRequestBodyAsync(cancellationToken);
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();
        var serial = FirstNonEmpty(
            Request.Query["SN"].ToString(),
            Request.Query["sn"].ToString(),
            Request.Query["serial"].ToString());

        await _ingest.IngestAsync(rawBody, serial, sourceIp, "webhook", cancellationToken);
        return Content("OK");
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> GetPipelineStatus(CancellationToken cancellationToken)
    {
        var recommended = AdmsWebhookUrlHelper.RecommendWebhookUrl(Request.Host.Host, Request.Scheme);
        return Ok(await _biometricService.GetAdmsPipelineStatusAsync(recommended, cancellationToken));
    }

    [Authorize]
    [HttpPost("replay-failed")]
    public async Task<IActionResult> ReplayFailed(CancellationToken cancellationToken)
    {
        var replayed = await _ingest.ReplayFailedRawEventsAsync(cancellationToken);
        var result = await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 100, cancellationToken);
        return Ok(new { replayedRawEvents = replayed, processResult = result });
    }

    [Authorize]
    [HttpPost("process-pending")]
    public async Task<IActionResult> ProcessPending(CancellationToken cancellationToken)
    {
        var result = await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 100, cancellationToken);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("drain-pending")]
    public async Task<IActionResult> DrainPending(CancellationToken cancellationToken)
    {
        var result = await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 200, cancellationToken);
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("events")]
    public async Task<IActionResult> ClearAdmsEvents(CancellationToken cancellationToken)
    {
        await _db.BiometricPunchEvents.ExecuteDeleteAsync(cancellationToken);
        await _db.BiometricRawEvents.ExecuteDeleteAsync(cancellationToken);
        return Ok(new { cleared = true });
    }

    [Authorize]
    [HttpPost("reprocess")]
    public async Task<IActionResult> Reprocess([FromQuery] int days = 7, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.Date.AddDays(-Math.Clamp(days, 1, 90));
        await _db.BiometricPunchEvents
            .Where(x => x.PunchAtUtc >= since)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ProcessedToAttendance, false), cancellationToken);
        var result = await _biometricService.ProcessAllPendingAdmsPunchesAsync(maxBatches: 200, cancellationToken);
        return Ok(result);
    }

    [Authorize]
    [HttpPost("consolidate-attendance")]
    public async Task<IActionResult> ConsolidateAttendance([FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.Date.AddDays(-Math.Clamp(days, 1, 365));
        var groups = await _db.AttendanceRecords
            .Where(a => a.Date >= since && a.Source == "Biometric")
            .GroupBy(a => new { a.EmployeeId, a.Date })
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);

        var merged = 0;
        foreach (var key in groups)
        {
            var rows = await _db.AttendanceRecords
                .Where(a => a.EmployeeId == key.EmployeeId && a.Date == key.Date && a.Source == "Biometric")
                .OrderBy(a => a.CreatedAt)
                .ToListAsync(cancellationToken);
            if (rows.Count < 2) continue;

            var keep = rows[0];
            foreach (var extra in rows.Skip(1))
            {
                if (extra.PunchIn.HasValue && (!keep.PunchIn.HasValue || extra.PunchIn < keep.PunchIn))
                    keep.PunchIn = extra.PunchIn;
                if (extra.PunchOut.HasValue && (!keep.PunchOut.HasValue || extra.PunchOut > keep.PunchOut))
                    keep.PunchOut = extra.PunchOut;
                _db.AttendanceRecords.Remove(extra);
                merged++;
            }

            if (keep.PunchIn.HasValue && keep.PunchOut.HasValue)
            {
                keep.WorkedHours = Math.Round(
                    (decimal)(keep.PunchOut.Value - keep.PunchIn.Value).TotalHours, 2);
            }
        }

        if (merged > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return Ok(new { duplicateRowsRemoved = merged });
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
                x.ParseError,
                x.Payload,
            })
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(x => new
        {
            x.Id,
            x.DeviceId,
            x.EventType,
            x.ReceivedAtUtc,
            x.SourceIp,
            x.ParseStatus,
            x.ParseError,
            PayloadPreview = x.Payload.Length > 120 ? x.Payload.Substring(0, 120) + "…" : x.Payload,
        }));
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
                x.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    private async Task<string> ReadRequestBodyAsync(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var raw = await reader.ReadToEndAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(raw))
            return raw;

        if (!Request.HasFormContentType)
            return raw;

        var form = await Request.ReadFormAsync(cancellationToken);
        foreach (var key in new[] { "content", "data", "log", "body", "ATTLOG" })
        {
            if (form.TryGetValue(key, out var val) && !string.IsNullOrWhiteSpace(val.ToString()))
                return val.ToString()!;
        }

        return raw;
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var v in values)
        {
            if (!string.IsNullOrWhiteSpace(v))
                return v.Trim();
        }
        return null;
    }
}
