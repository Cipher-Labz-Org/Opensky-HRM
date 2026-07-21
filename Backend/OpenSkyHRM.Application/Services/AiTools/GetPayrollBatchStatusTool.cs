using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetPayrollBatchStatusTool : AiToolBase
{
    private readonly IPayrollService _payrollService;

    public GetPayrollBatchStatusTool(IPayrollService payrollService) => _payrollService = payrollService;

    public override string Name => "get_payroll_batch_status";
    public override string Description =>
        "Summarize recent payroll batches and their processing status.";
    public override IReadOnlyList<string> RequiredModules => ["Payroll"];
    public override IReadOnlyList<string> RequiredPermissions => ["Payroll:Read:All"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max batches to return (default 10)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var limit = Math.Clamp(GetInt(args, "limit") ?? 10, 1, 25);
        var batches = await _payrollService.GetBatchesAsync(1, limit);

        var items = batches.Items.Select(b => new
        {
            b.BatchCode,
            period = $"{b.Year}-{b.Month:D2}",
            b.Status,
            b.ProcessType,
            b.EmployeeCount,
            b.TotalNet,
            processedAt = b.ProcessedAt?.ToString("yyyy-MM-dd"),
        }).ToList();

        var byStatus = items.GroupBy(b => b.Status).ToDictionary(g => g.Key, g => g.Count());

        return AiToolResult.Ok(new
        {
            totalBatches = batches.TotalCount,
            byStatus,
            recentBatches = items,
        }, $"{batches.TotalCount} payroll batch(es) on record; showing {items.Count} most recent");
    }
}
