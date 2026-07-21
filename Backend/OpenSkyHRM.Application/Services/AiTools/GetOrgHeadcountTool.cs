using System.Text.Json;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetOrgHeadcountTool : AiToolBase
{
    private readonly IAnalyticsService _analytics;
    private readonly IPeopleScopeService _scope;

    public GetOrgHeadcountTool(IAnalyticsService analytics, IPeopleScopeService scope)
    {
        _analytics = analytics;
        _scope = scope;
    }

    public override string Name => "get_org_headcount";
    public override string Description =>
        "Get employee headcount totals and breakdown by department or business unit. ALWAYS use this tool for workforce size, employee counts, headcount, or distribution by department — not search_employees.";
    public override IReadOnlyList<string> RequiredModules => ["People", "Analytics"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            departmentName = new { type = "string", description = "Optional department name filter" },
            groupBy = new { type = "string", description = "department or businessUnit" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        if (!HasAnyModule(ctx.User, "People", "Analytics"))
            return AiToolResult.Denied("People or Analytics module required.");

        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var deptFilter = GetString(args, "departmentName");
        var groupBy = GetString(args, "groupBy") ?? "department";
        var analytics = await _analytics.GetHeadcountAnalyticsAsync(allowedIds, ct);

        var byDepartment = analytics.ByDepartment;
        var byBusinessUnit = analytics.ByBusinessUnit;
        if (!string.IsNullOrWhiteSpace(deptFilter))
        {
            var filter = deptFilter.Trim();
            byDepartment = byDepartment
                .Where(kvp => kvp.Key.Contains(filter, StringComparison.OrdinalIgnoreCase))
                .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
        }

        var primaryBreakdown = string.Equals(groupBy, "businessUnit", StringComparison.OrdinalIgnoreCase)
            ? byBusinessUnit
            : byDepartment;

        return AiToolResult.Ok(new
        {
            totalEmployees = analytics.TotalEmployees,
            totalActiveEmployees = analytics.ActiveEmployees,
            onLeave = analytics.OnLeave,
            terminated = analytics.Terminated,
            byDepartment,
            byBusinessUnit,
            filteredDepartment = deptFilter,
            peopleScope = _scope.ResolvePeopleScope(ctx.User),
            primaryBreakdown,
        }, $"Headcount: {analytics.ActiveEmployees} active employees ({analytics.TotalEmployees} total)");
    }

    private static bool HasAnyModule(AiUserContext user, params string[] modules) =>
        modules.Any(m => user.LicensedModules.Any(l => string.Equals(l, m, StringComparison.OrdinalIgnoreCase)));
}
