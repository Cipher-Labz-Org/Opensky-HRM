using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Helpers;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Analytics")]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    /// <summary>
    /// Report rows use display-name dictionary keys (e.g. "Employee Code"); disable dictionary key camelCase.
    /// </summary>
    private static readonly JsonSerializerOptions ReportJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = null,
    };

    private readonly IReportService _reportService;
    public ReportsController(IReportService reportService) { _reportService = reportService; }

    [HttpGet("catalog")]
    public IActionResult GetCatalog() => Ok(_reportService.GetReportCatalog());

    [HttpGet("{category}/{reportKey}")]
    public async Task<IActionResult> RunReport(string category, string reportKey, [FromQuery] Dictionary<string, string>? filters = null)
    {
        var result = await _reportService.RunReportAsync(category, reportKey, filters);
        return new JsonResult(result, ReportJsonOptions);
    }

    [HttpGet("{category}/{reportKey}/csv")]
    public async Task<IActionResult> ExportCsv(string category, string reportKey, [FromQuery] Dictionary<string, string>? filters = null)
    {
        var result = await _reportService.RunReportAsync(category, reportKey, filters);
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", result.Columns.Select(EscapeCsv)));
        foreach (var row in result.Rows)
            sb.AppendLine(string.Join(",", result.Columns.Select(c => EscapeCsv(row.TryGetValue(c, out var v) ? v?.ToString() ?? "" : ""))));
        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"{result.ReportName.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    [HttpGet("{category}/{reportKey}/xlsx")]
    public async Task<IActionResult> ExportXlsx(string category, string reportKey, [FromQuery] Dictionary<string, string>? filters = null)
    {
        var result = await _reportService.RunReportAsync(category, reportKey, filters);
        var bytes = ReportExcelExport.BuildWorkbook(result);
        var filename = $"{result.ReportName.Replace(" ", "_")}_{DateTime.UtcNow:yyyy-MM-dd}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    private static string EscapeCsv(string val)
    {
        if (val.Contains(',') || val.Contains('"') || val.Contains('\n'))
            return $"\"{val.Replace("\"", "\"\"")}\"";
        return val;
    }
}
