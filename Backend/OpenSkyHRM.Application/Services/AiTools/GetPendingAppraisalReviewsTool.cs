using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetPendingAppraisalReviewsTool : AiToolBase
{
    private readonly IAppraisalService _appraisalService;

    public GetPendingAppraisalReviewsTool(IAppraisalService appraisalService) =>
        _appraisalService = appraisalService;

    public override string Name => "get_pending_appraisal_reviews";
    public override string Description =>
        "List performance appraisal reviews awaiting the current user's input.";
    public override IReadOnlyList<string> RequiredModules => ["Performance"];

    public override JsonDocument InputSchema => Schema(new { type = "object", properties = new { } });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        if (!ctx.User.EmployeeId.HasValue)
            return AiToolResult.Denied("Your account is not linked to an employee profile.");

        var tasks = await _appraisalService.GetMyReviewTasksAsync(ctx.User.EmployeeId.Value);

        var items = tasks
            .Take(15)
            .Select(a => new
            {
                a.EmployeeName,
                a.EmployeeCode,
                a.DepartmentName,
                a.CycleName,
                a.Status,
                pendingReviewers = a.Reviewers.Count(r => r.Status != "Submitted"),
            })
            .ToList();

        return AiToolResult.Ok(new
        {
            pendingCount = tasks.Count,
            reviews = items,
        }, tasks.Count == 0
            ? "No pending appraisal reviews for you"
            : $"{tasks.Count} appraisal review(s) awaiting your input");
    }
}
