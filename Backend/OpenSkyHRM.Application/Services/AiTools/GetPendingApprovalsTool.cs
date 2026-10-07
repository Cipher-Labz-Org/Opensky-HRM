using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetPendingApprovalsTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetPendingApprovalsTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_pending_approvals";
    public override string Description =>
        "List leave requests awaiting approval that the current user can act on or see within their scope.";
    public override IReadOnlyList<string> RequiredModules => ["Leave"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new { limit = new { type = "integer", description = "Max rows (default 10)" } },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        if (!ctx.User.LicensedModules.Any(m => string.Equals(m, "Leave", StringComparison.OrdinalIgnoreCase)))
            return AiToolResult.Denied("Leave module is not licensed.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 10, 1, 25);
        var approvalsScope = ResolveModuleScope(ctx.User.Permissions, "Approvals", "Read");
        IReadOnlyList<Guid>? allowedIds;
        if (approvalsScope == "All")
            allowedIds = null;
        else if (approvalsScope == "Own" && ctx.User.EmployeeId.HasValue)
            allowedIds = new[] { ctx.User.EmployeeId.Value };
        else if (approvalsScope == "Team" && ctx.User.EmployeeId.HasValue)
        {
            var graph = await ReportingChain.LoadAsync(ctx.Db, ct);
            var teamIds = ReportingChain.GetDescendantIds(graph, ctx.User.EmployeeId.Value);
            teamIds.Add(ctx.User.EmployeeId.Value);
            allowedIds = teamIds.ToList();
        }
        else
            allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);

        var q = ctx.Db.LeaveRequests.AsNoTracking()
            .Include(r => r.Employee)
            .Include(r => r.LeaveType)
            .Where(r => !r.IsDeleted && (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2 || r.Status == ApprovalStatus.CancellationRequested));

        if (allowedIds != null)
            q = q.Where(r => allowedIds.Contains(r.EmployeeId));

        if (ctx.User.EmployeeId.HasValue)
        {
            var approverId = ctx.User.EmployeeId.Value;
            q = q.Where(r =>
                r.ApproverId == approverId
                || r.Level1ApproverId == approverId
                || r.Level2ApproverId == approverId
                || allowedIds == null);
        }

        var items = await q
            .OrderByDescending(r => r.CreatedAt)
            .Take(limit)
            .Select(r => new
            {
                r.Id,
                employeeName = r.Employee.FirstName + " " + r.Employee.LastName,
                leaveType = r.LeaveType.Name,
                r.StartDate,
                r.EndDate,
                r.Status,
            })
            .ToListAsync(ct);

        var total = await q.CountAsync(ct);

        return AiToolResult.Ok(new { totalPending = total, items }, $"{total} pending leave approvals");
    }

    private static string ResolveModuleScope(IReadOnlyList<string> permissions, string module, string action)
    {
        var prefix = $"{module}:{action}:";
        var matches = permissions.Where(p => p.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)).ToList();
        if (matches.Any(p => p.EndsWith(":All", StringComparison.OrdinalIgnoreCase))) return "All";
        if (matches.Any(p => p.EndsWith(":Team", StringComparison.OrdinalIgnoreCase))) return "Team";
        if (matches.Any(p => p.EndsWith(":Own", StringComparison.OrdinalIgnoreCase))) return "Own";
        return "None";
    }
}
