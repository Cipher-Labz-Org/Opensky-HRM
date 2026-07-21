using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetUpcomingProbationEndTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetUpcomingProbationEndTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_upcoming_probation_end";
    public override string Description =>
        "List employees whose probation period ends within the next N days.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            days = new { type = "integer", description = "Lookahead days (default 30)" },
            limit = new { type = "integer", description = "Max rows (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var days = Math.Clamp(GetInt(args, "days") ?? 30, 1, 180);
        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);
        var today = DateTime.UtcNow.Date;
        var endDate = today.AddDays(days);

        var q = ctx.Db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted
                        && e.ProbationEndDate != null
                        && e.ProbationEndDate >= today
                        && e.ProbationEndDate <= endDate
                        && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase));

        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(e => e.ProbationEndDate)
            .Take(limit)
            .Select(e => new
            {
                name = e.FirstName + " " + e.LastName,
                e.EmployeeCode,
                probationEnd = e.ProbationEndDate!.Value.ToString("yyyy-MM-dd"),
                daysRemaining = (e.ProbationEndDate!.Value.Date - today).Days,
                department = e.Department != null ? e.Department.Name : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new { days, total, employees = items },
            total == 0 ? "No probation periods ending soon" : $"{total} probation period(s) ending in the next {days} days");
    }
}
