using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.Services.AiTools;

public sealed class GetEmployeeSummaryTool : AiToolBase
{
    private readonly IPeopleScopeService _scope;

    public GetEmployeeSummaryTool(IPeopleScopeService scope) => _scope = scope;

    public override string Name => "get_employee_summary";
    public override string Description => "Get a summary profile for one employee by ID or employee code.";
    public override IReadOnlyList<string> RequiredModules => ["People"];

    public override JsonDocument InputSchema => Schema(new
    {
        type = "object",
        properties = new
        {
            employeeId = new { type = "string", description = "Employee GUID" },
            employeeCode = new { type = "string", description = "Employee code" },
        },
    });

    public override async Task<AiToolResult> ExecuteAsync(AiToolContext ctx, JsonElement args, CancellationToken ct)
    {
        Guid? employeeId = null;
        if (args.TryGetProperty("employeeId", out var idEl) && Guid.TryParse(idEl.GetString(), out var parsed))
            employeeId = parsed;

        var employeeCode = GetString(args, "employeeCode");

        if (!employeeId.HasValue && string.IsNullOrWhiteSpace(employeeCode))
            return AiToolResult.Denied("employeeId or employeeCode is required");

        var q = ctx.Db.Employees.AsNoTracking().Where(e => !e.IsDeleted);
        if (employeeId.HasValue)
            q = q.Where(e => e.Id == employeeId.Value);
        else
            q = q.Where(e => e.EmployeeCode == employeeCode);

        var employee = await q.Select(e => new
        {
            e.Id,
            name = e.FirstName + " " + e.LastName,
            e.EmployeeCode,
            e.Status,
            e.Email,
            department = e.Department != null ? e.Department.Name : null,
            jobTitle = e.JobTitle != null ? e.JobTitle.Title : null,
            manager = e.Manager != null ? e.Manager.FirstName + " " + e.Manager.LastName : null,
            e.JoinDate,
        }).FirstOrDefaultAsync(ct);

        if (employee == null)
            return AiToolResult.Ok(new { found = false }, "Employee not found");

        if (!await _scope.CanAccessEmployeeAsync(ctx.User, employee.Id, "Read", ct))
            return AiToolResult.Denied("You do not have access to this employee record.");

        return AiToolResult.Ok(new { found = true, employee }, $"Summary for {employee.name}");
    }
}
