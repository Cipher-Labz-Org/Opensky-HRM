using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetOverdueTrainingTool : AiToolBase
{
    private readonly ITrainingAssignmentService _trainingService;
    private readonly IPeopleScopeService _scope;

    public GetOverdueTrainingTool(ITrainingAssignmentService trainingService, IPeopleScopeService scope)
    {
        _trainingService = trainingService;
        _scope = scope;
    }

    public override string Name => "get_overdue_training";
    public override string Description =>
        "List overdue training assignments for employees within the user's scope.";
    public override IReadOnlyList<string> RequiredModules => ["Learning"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max rows (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);
        var overdue = await _trainingService.GetAssignmentsAsync(allowedIds, overdueOnly: true, cancellationToken: ct);

        var items = overdue
            .OrderBy(a => a.DueDate)
            .Take(limit)
            .Select(a => new
            {
                a.EmployeeName,
                a.CourseTitle,
                a.CourseCode,
                dueDate = a.DueDate?.ToString("yyyy-MM-dd"),
                daysOverdue = a.DueDate.HasValue
                    ? (DateTime.UtcNow.Date - a.DueDate.Value.Date).Days
                    : (int?)null,
                a.Status,
            })
            .ToList();

        return AiToolResult.Ok(new
        {
            totalOverdue = overdue.Count,
            assignments = items,
        }, overdue.Count == 0
            ? "No overdue training assignments"
            : $"{overdue.Count} overdue training assignment(s)");
    }
}
