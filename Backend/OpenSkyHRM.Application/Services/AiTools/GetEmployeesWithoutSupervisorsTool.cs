using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetEmployeesWithoutSupervisorsTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetEmployeesWithoutSupervisorsTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_employees_without_supervisors";
    public override string Description =>
        "List active employees who do not have a direct supervisor assigned (excluding top-of-hierarchy roles). Use for questions about employees without supervisors, missing managers, or reporting gaps.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            limit = new { type = "integer", description = "Max sample rows to return (default 15)" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        var allowedIds = await _scope.GetAllowedEmployeeIdsAsync(ctx.User, "Read", ct);
        if (allowedIds is { Count: 0 })
            return AiToolResult.Denied("You do not have access to employee records.");

        var limit = Math.Clamp(GetInt(args, "limit") ?? 15, 1, 50);

        var employeesWithDirectSupervisor = ctx.Db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Where(s => !s.IsDeleted && s.ReportingMethod == "Direct")
            .Select(s => s.EmployeeId);

        var q = ctx.Db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted
                        && !e.IsTopOfHierarchy
                        && !string.Equals(e.Status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase)
                        && !employeesWithDirectSupervisor.Contains(e.Id));

        if (allowedIds != null)
            q = q.Where(e => allowedIds.Contains(e.Id));

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(e => e.LastName).ThenBy(e => e.FirstName)
            .Take(limit)
            .Select(e => new
            {
                name = e.FirstName + " " + e.LastName,
                e.EmployeeCode,
                department = e.Department != null ? e.Department.Name : "Unassigned",
                jobTitle = e.JobTitle != null ? e.JobTitle.Title : null,
            })
            .ToListAsync(ct);

        return AiToolResult.Ok(new
        {
            totalWithoutDirectSupervisor = total,
            sampleCount = items.Count,
            employees = items,
            note = total > items.Count
                ? $"Showing first {items.Count} of {total}. Open People Hub to review or assign supervisors."
                : null,
        }, total == 0
            ? "All active employees have a direct supervisor assigned (or are marked top of hierarchy)."
            : $"{total} active employee(s) without a direct supervisor");
    }
}
