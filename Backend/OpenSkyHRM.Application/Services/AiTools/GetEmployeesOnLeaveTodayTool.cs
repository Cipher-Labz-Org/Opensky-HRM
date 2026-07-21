using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetEmployeesOnLeaveTodayTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetEmployeesOnLeaveTodayTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_employees_on_leave_today";
    public override string Description =>
        "List employees on approved leave today within the user's scope.";
    public override IReadOnlyList<string> RequiredModules => ["Leave"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max rows (default 20)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 20, 1, 50);
        var today = DateTime.UtcNow.Date;

        var q = ctx.Db.LeaveRequests.AsNoTracking()
            .Include(r => r.Employee)
            .Include(r => r.LeaveType)
            .Where(r => !r.IsDeleted
                        && r.Status == ApprovalStatus.Approved
                        && r.StartDate.Date <= today
                        && r.EndDate.Date >= today);

        if (allowedIds != null)
            q = q.Where(r => allowedIds.Contains(r.EmployeeId));

        var total = await q.CountAsync(ct);
        var onLeave = await q
            .OrderBy(r => r.Employee.LastName).ThenBy(r => r.Employee.FirstName)
            .Take(limit)
            .Select(r => new
            {
                name = r.Employee.FirstName + " " + r.Employee.LastName,
                r.Employee.EmployeeCode,
                leaveType = r.LeaveType.Name,
                from = r.StartDate.ToString("yyyy-MM-dd"),
                to = r.EndDate.ToString("yyyy-MM-dd"),
                department = r.Employee.Department != null ? r.Employee.Department.Name : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new { date = today.ToString("yyyy-MM-dd"), total, onLeave },
            total == 0 ? "No employees on approved leave today" : $"{total} employee(s) on leave today");
    }
}
