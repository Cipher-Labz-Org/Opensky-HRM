using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetRecruitmentPipelineTool : AiToolBase
{
    private readonly IRecruitmentService _recruitmentService;

    public GetRecruitmentPipelineTool(IRecruitmentService recruitmentService) =>
        _recruitmentService = recruitmentService;

    public override string Name => "get_recruitment_pipeline";
    public override string Description => "Summarize open requisitions and hiring pipeline counts.";
    public override IReadOnlyList<string> RequiredModules => ["Recruitment"];
    public override IReadOnlyList<string> RequiredPermissions => ["Recruitment:Read:All"];

    public override JsonDocument InputSchema => Schema(new { type = "object", properties = new { } });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var openReqs = await _recruitmentService.GetRequisitionsAsync(1, 100, status: "Open");
        var approvedReqs = await _recruitmentService.GetRequisitionsAsync(1, 100, status: "Approved");

        var items = openReqs.Items.Concat(approvedReqs.Items)
            .GroupBy(r => r.Id)
            .Select(g => g.First())
            .Take(15)
            .Select(r => new
            {
                r.Id,
                r.Title,
                r.Status,
                department = r.DepartmentName,
                r.Priority,
            })
            .ToList();

        return AiToolResult.Ok(new
        {
            openCount = openReqs.TotalCount,
            approvedCount = approvedReqs.TotalCount,
            sampleRequisitions = items,
        }, $"{openReqs.TotalCount + approvedReqs.TotalCount} active requisitions");
    }
}
