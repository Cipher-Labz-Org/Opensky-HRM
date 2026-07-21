using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetPendingOnboardingTasksTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetPendingOnboardingTasksTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_pending_onboarding_tasks";
    public override string Description =>
        "Summarize incomplete onboarding tasks and employees with pending onboarding work.";
    public override IReadOnlyList<string> RequiredModules => ["Onboarding"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max task rows (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);
        var today = DateTime.UtcNow.Date;

        var q = ctx.Db.OnboardingTasks.AsNoTracking()
            .Include(t => t.Employee)
            .Where(t => !t.IsDeleted && !t.IsCompleted);

        if (allowedIds != null)
            q = q.Where(t => allowedIds.Contains(t.EmployeeId));

        var totalPending = await q.CountAsync(ct);
        var overdueCount = await q.CountAsync(t => t.DueDate != null && t.DueDate < today, ct);
        var employeesWithPending = await q.Select(t => t.EmployeeId).Distinct().CountAsync(ct);

        var tasks = await q
            .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
            .ThenBy(t => t.SortOrder)
            .Take(limit)
            .Select(t => new
            {
                t.Title,
                t.Category,
                employee = t.Employee.FirstName + " " + t.Employee.LastName,
                dueDate = t.DueDate != null ? t.DueDate.Value.ToString("yyyy-MM-dd") : null,
                isOverdue = t.DueDate != null && t.DueDate < today,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new
        {
            totalPendingTasks = totalPending,
            overdueTasks = overdueCount,
            employeesWithPendingTasks = employeesWithPending,
            sampleTasks = tasks,
        }, $"{totalPending} pending onboarding task(s) across {employeesWithPending} employee(s)");
    }
}
