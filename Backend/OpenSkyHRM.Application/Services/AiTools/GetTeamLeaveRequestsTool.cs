using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetTeamLeaveRequestsTool : AiToolBase
{
    private readonly ILeaveService _leaveService;
    private readonly IPeopleScopeService _scope;

    public GetTeamLeaveRequestsTool(ILeaveService leaveService, IPeopleScopeService scope)
    {
        _leaveService = leaveService;
        _scope = scope;
    }

    public override string Name => "get_team_leave_requests";
    public override string Description => "List leave requests for employees in the user's scope.";
    public override IReadOnlyList<string> RequiredModules => ["Leave"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            status = new { type = "string", description = "Pending, Approved, Rejected, or All" },
            limit = new { type = "integer" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var statusRaw = GetString(args, "status");
        var limit = Math.Clamp(GetInt(args, "limit") ?? 10, 1, 25);
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);

        string? status = null;
        if (!string.IsNullOrWhiteSpace(statusRaw) && !string.Equals(statusRaw, "All", StringComparison.OrdinalIgnoreCase))
            status = statusRaw;

        var page = await _leaveService.GetLeaveRequestsAsync(1, limit, status, allowedEmployeeIds: allowedIds?.ToList());
        var items = page.Items.Select(r => new
        {
            r.Id,
            employeeName = r.EmployeeName,
            r.LeaveTypeName,
            r.StartDate,
            r.EndDate,
            status = r.Status,
        });

        return AiToolResult.Ok(new { total = page.TotalCount, items }, $"{page.TotalCount} leave requests");
    }
}
