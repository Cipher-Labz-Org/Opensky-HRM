using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class SearchEmployeesTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public SearchEmployeesTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "search_employees";
    public override string Description => "Search employees by name or employee code within the user's access scope.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            query = new { type = "string", description = "Name or employee code fragment" },
            limit = new { type = "integer" },
        },
        required = new[] { "query" },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var query = GetString(args, "query");
        if (string.IsNullOrWhiteSpace(query))
            return AiToolResult.Denied("query is required");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 10, 1, 20);
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var qLower = query.ToLower();
        var q = ctx.Db.Employees.AsNoTracking().Where(e => !e.IsDeleted
            && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase));
        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        q = q.Where(e =>
            e.FirstName.ToLower().Contains(qLower)
            || e.LastName.ToLower().Contains(qLower)
            || e.EmployeeCode.ToLower().Contains(qLower));

        var items = await q
            .OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
            .Take(limit)
            .Select(e => new
            {
                e.Id,
                name = e.FirstName + " " + e.LastName,
                e.EmployeeCode,
                department = e.Department != null ? e.Department.Name : null,
                jobTitle = e.JobTitle != null ? e.JobTitle.Title : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new { count = items.Count, items }, $"Found {items.Count} employees");
    }
}
