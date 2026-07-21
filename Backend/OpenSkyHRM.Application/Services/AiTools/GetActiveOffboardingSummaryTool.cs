using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetActiveOffboardingSummaryTool : AiToolBase
{
    private readonly IOffboardingService _offboardingService;
    private readonly IPeopleScopeService _scope;

    public GetActiveOffboardingSummaryTool(IOffboardingService offboardingService, IPeopleScopeService scope)
    {
        _offboardingService = offboardingService;
        _scope = scope;
    }

    public override string Name => "get_active_offboarding_summary";
    public override string Description =>
        "Summarize employees currently in offboarding and their task completion progress.";
    public override IReadOnlyList<string> RequiredModules => ["Offboarding"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max employees to return (default 10)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 10, 1, 25);
        var all = await _offboardingService.GetActiveOffboardingsAsync();

        var filtered = allowedIds == null
            ? all
            : all.Where(o => allowedIds.Contains(o.EmployeeId)).ToList();

        var items = filtered
            .Take(limit)
            .Select(o => new
            {
                o.EmployeeName,
                o.EmployeeCode,
                o.DepartmentName,
                terminationDate = o.TerminationDate?.ToString("yyyy-MM-dd"),
                o.TotalTasks,
                o.CompletedTasks,
                pendingTasks = o.TotalTasks - o.CompletedTasks,
                completionPercent = o.TotalTasks > 0
                    ? Math.Round(o.CompletedTasks * 100.0 / o.TotalTasks, 0)
                    : 100,
            })
            .ToList();

        return AiToolResult.Ok(new
        {
            activeOffboardings = filtered.Count,
            employees = items,
        }, filtered.Count == 0
            ? "No active offboarding cases"
            : $"{filtered.Count} employee(s) currently in offboarding");
    }
}
