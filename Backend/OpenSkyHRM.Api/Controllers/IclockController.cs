using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Services;

namespace OpenSkyHRM.Api.Controllers;

/// <summary>
/// ZKTeco / iClock ADMS push protocol (devices call /iclock/cdata and /iclock/getrequest).
/// </summary>
[ApiController]
[Route("iclock")]
public class IclockController : ControllerBase
{
    private readonly BiometricAdmsIngestService _ingest;

    public IclockController(BiometricAdmsIngestService ingest)
    {
        _ingest = ingest;
    }

    /// <summary>Device heartbeat / command poll — must return OK.</summary>
    [AllowAnonymous]
    [HttpGet("getrequest")]
    public async Task<IActionResult> GetRequest([FromQuery] string? SN, [FromQuery] string? sn, CancellationToken cancellationToken)
    {
        await _ingest.TouchDeviceAsync(FirstNonEmpty(SN, sn), cancellationToken);
        return Content("OK", "text/plain");
    }

    /// <summary>Device config ping (some firmware).</summary>
    [AllowAnonymous]
    [HttpGet("cdata")]
    public async Task<IActionResult> CDataGet([FromQuery] string? SN, [FromQuery] string? sn, CancellationToken cancellationToken)
    {
        await _ingest.TouchDeviceAsync(FirstNonEmpty(SN, sn), cancellationToken);
        return Content("OK", "text/plain");
    }

    /// <summary>Attendance (ATTLOG) and operation logs push.</summary>
    [AllowAnonymous]
    [HttpPost("cdata")]
    public async Task<IActionResult> CDataPost(CancellationToken cancellationToken)
    {
        var serial = FirstNonEmpty(
            Request.Query["SN"].ToString(),
            Request.Query["sn"].ToString(),
            Request.Query["serial"].ToString());

        var table = Request.Query["table"].ToString();
        var eventType = string.IsNullOrWhiteSpace(table) ? "cdata" : table;

        var body = await ReadDeviceBodyAsync(cancellationToken);
        var sourceIp = HttpContext.Connection.RemoteIpAddress?.ToString();

        if (IsAttendanceTable(table))
            await _ingest.IngestAsync(body, serial, sourceIp, eventType, cancellationToken);

        return Content("OK", "text/plain");
    }

    private static bool IsAttendanceTable(string? table) =>
        string.IsNullOrWhiteSpace(table) ||
        table.Equals("ATTLOG", StringComparison.OrdinalIgnoreCase) ||
        table.Equals("OPERLOG", StringComparison.OrdinalIgnoreCase);

    private async Task<string> ReadDeviceBodyAsync(CancellationToken cancellationToken)
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
