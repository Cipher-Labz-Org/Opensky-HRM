using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetRecentNewHiresTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetRecentNewHiresTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_recent_new_hires";
    public override string Description =>
        "List employees who joined the organization within the last N days.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            days = new { type = "integer", description = "Lookback days (default 30)" },
            limit = new { type = "integer", description = "Max rows (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var days = Math.Clamp(GetInt(args, "days") ?? 30, 1, 365);
        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);
        var cutoff = DateTime.UtcNow.Date.AddDays(-days);

        var q = ctx.Db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted
                        && e.JoinDate >= cutoff
                        && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase));

        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        var total = await q.CountAsync(ct);
        var hires = await q
            .OrderByDescending(e => e.JoinDate)
            .Take(limit)
            .Select(e => new
            {
                name = e.FirstName + " " + e.LastName,
                e.EmployeeCode,
                joined = e.JoinDate.ToString("yyyy-MM-dd"),
                department = e.Department != null ? e.Department.Name : null,
                jobTitle = e.JobTitle != null ? e.JobTitle.Title : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new { days, total, hires }, $"{total} new hire(s) in the last {days} days");
    }
}
