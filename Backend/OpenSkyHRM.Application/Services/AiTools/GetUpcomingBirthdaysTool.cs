using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetUpcomingBirthdaysTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetUpcomingBirthdaysTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_upcoming_birthdays";
    public override string Description => "List employee birthdays in the next N days within the user's scope.";
    public override IReadOnlyList<string> RequiredModules => ["People", "Dashboard"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new { days = new { type = "integer", description = "Lookahead days (default 14)" } },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var days = Math.Clamp(GetInt(args, "days") ?? 14, 1, 60);
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var today = DateTime.UtcNow.Date;
        var q = ctx.Db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted
                        && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase)
                        && e.DateOfBirth.Year > 1900);

        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        var employees = await q
            .Select(e => new { e.Id, e.FirstName, e.LastName, e.DateOfBirth, department = e.Department != null ? e.Department.Name : null })
            .ToListAsync(ct);

        var upcoming = employees
            .Select(e =>
            {
                var next = new DateTime(today.Year, e.DateOfBirth.Month, e.DateOfBirth.Day);
                if (next < today) next = next.AddYears(1);
                var inDays = (next - today).Days;
                return new { e.Id, name = $"{e.FirstName} {e.LastName}", e.department, birthday = next.ToString("yyyy-MM-dd"), inDays };
            })
            .Where(x => x.inDays <= days)
            .OrderBy(x => x.inDays)
            .Take(20)
            .ToList();

        return AiToolResult.Ok(new { days, count = upcoming.Count, upcoming }, $"{upcoming.Count} upcoming birthdays");
    }
}
