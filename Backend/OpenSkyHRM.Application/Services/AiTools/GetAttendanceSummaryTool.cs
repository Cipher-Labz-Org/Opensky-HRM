using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetAttendanceSummaryTool : AiToolBase
{
    private readonly IAttendanceService _attendanceService;
    private readonly IPeopleScopeService _scope;

    public GetAttendanceSummaryTool(IAttendanceService attendanceService, IPeopleScopeService scope)
    {
        _attendanceService = attendanceService;
        _scope = scope;
    }

    public override string Name => "get_attendance_summary";
    public override string Description => "Get attendance summary for today or a date range within the user's scope.";
    public override IReadOnlyList<string> RequiredModules => ["Attendance"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            fromDate = new { type = "string", description = "ISO date yyyy-MM-dd" },
            toDate = new { type = "string", description = "ISO date yyyy-MM-dd" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var today = DateTime.UtcNow.Date;
        var from = ParseDate(GetString(args, "fromDate")) ?? today;
        var to = ParseDate(GetString(args, "toDate")) ?? today;
        if (to < from) (from, to) = (to, from);

        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        Guid? employeeId = ctx.User.EmployeeId;

        if (allowedIds == null)
            employeeId = null;
        else if (employeeId.HasValue && !allowedIds.Contains(employeeId.Value))
            employeeId = null;

        var summary = await _attendanceService.GetSummaryAsync(from, to, employeeId, allowedIds);

        return AiToolResult.Ok(new
        {
            fromDate = from.ToString("yyyy-MM-dd"),
            toDate = to.ToString("yyyy-MM-dd"),
            summary,
        }, $"Attendance summary {from:yyyy-MM-dd} to {to:yyyy-MM-dd}");
    }

    private static DateTime? ParseDate(string? raw) =>
        DateTime.TryParse(raw, out var d) ? d.Date : null;
}
