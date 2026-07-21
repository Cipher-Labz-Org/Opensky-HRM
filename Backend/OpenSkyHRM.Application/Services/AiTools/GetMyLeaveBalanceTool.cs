using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetMyLeaveBalanceTool : AiToolBase
{
    private readonly ILeaveService _leaveService;

    public GetMyLeaveBalanceTool(ILeaveService leaveService) => _leaveService = leaveService;

    public override string Name => "get_my_leave_balance";
    public override string Description => "Get leave balances for the current user for the current year.";
    public override IReadOnlyList<string> RequiredModules => ["Leave"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new { year = new { type = "integer", description = "Calendar year (default: current year)" } },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        if (!ctx.User.EmployeeId.HasValue)
            return AiToolResult.Denied("Your user account is not linked to an employee record.");

        var year = GetInt(args, "year") ?? DateTime.UtcNow.Year;
        var balances = await _leaveService.GetEmployeeBalancesAsync(ctx.User.EmployeeId.Value, year);

        return AiToolResult.Ok(new
        {
            employeeId = ctx.User.EmployeeId,
            year,
            balances = balances.Select(b => new
            {
                b.LeaveTypeName,
                b.Entitled,
                b.Used,
                balance = b.Remaining,
            }),
        }, $"Leave balances for {year}");
    }
}
