using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Payroll")]
[Route("api/[controller]")]
public class PayrollController : ControllerBase
{
    private readonly IPayrollService _payrollService;
    private readonly PayrollCalculationEngine _engine;
    private readonly AppDbContext _db;

    public PayrollController(IPayrollService payrollService, PayrollCalculationEngine engine, AppDbContext db)
    {
        _payrollService = payrollService;
        _engine = engine;
        _db = db;
    }

    // ── Compensation Components ──────────────────────────────────────

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents()
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        return Ok(await _payrollService.GetComponentsAsync());
    }

    [HttpGet("components/{id:guid}")]
    public async Task<IActionResult> GetComponent(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.GetComponentByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("components")]
    public async Task<IActionResult> CreateComponent([FromBody] CreateComponentDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.CreateComponentAsync(dto);
        return CreatedAtAction(nameof(GetComponent), new { id = result.Id }, result);
    }

    [HttpPut("components/{id:guid}")]
    public async Task<IActionResult> UpdateComponent(Guid id, [FromBody] UpdateComponentDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.UpdateComponentAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("components/{id:guid}")]
    public async Task<IActionResult> DeleteComponent(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var ok = await _payrollService.DeleteComponentAsync(id);
        return ok ? NoContent() : NotFound();
    }

    // ── Variable Compensation (batch-level view) ───────────────────

    [HttpGet("compensation/variable")]
    public async Task<IActionResult> GetVariableCompensation([FromQuery] Guid batchId, [FromQuery] Guid? componentId = null)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var query = _db.EmployeeCompensations
            .Include(ec => ec.Employee)
            .Include(ec => ec.Component)
            .Where(ec => ec.BatchId == batchId && ec.IsActive);

        if (componentId.HasValue)
            query = query.Where(ec => ec.ComponentId == componentId.Value);

        var items = await query.OrderBy(ec => ec.Employee.FirstName).ThenBy(ec => ec.Employee.LastName)
            .Select(ec => new {
                ec.Id, ec.EmployeeId, ec.ComponentId, ec.Amount, ec.Currency,
                employeeName = ec.Employee.FirstName + " " + ec.Employee.LastName,
                employeeCode = ec.Employee.EmployeeCode,
                department = ec.Employee.Department != null ? ec.Employee.Department.Name : "",
                componentName = ec.Component.Name,
                componentCode = ec.Component.Code,
            }).ToListAsync();

        return Ok(items);
    }

    [HttpPut("compensation/variable/bulk")]
    public async Task<IActionResult> BulkUpdateVariable([FromBody] BulkVariableUpdateRequest request)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        if (request.Updates is null || request.Updates.Count == 0)
            return BadRequest(new { message = "No updates provided." });

        var ids = request.Updates.Select(u => u.Id).ToList();
        var entities = await _db.EmployeeCompensations
            .Where(ec => ids.Contains(ec.Id))
            .ToListAsync();

        foreach (var entity in entities)
        {
            var upd = request.Updates.FirstOrDefault(u => u.Id == entity.Id);
            if (upd != null) entity.Amount = upd.Amount;
        }

        await _db.SaveChangesAsync();
        return Ok(new { updated = entities.Count });
    }

    // ── Employee Compensation ────────────────────────────────────────

    [HttpGet("compensation/{employeeId:guid}")]
    public async Task<IActionResult> GetCompensation(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _payrollService.GetEmployeeCompensationAsync(employeeId));
    }

    [HttpPost("compensation/{employeeId:guid}")]
    public async Task<IActionResult> CreateCompensation(Guid employeeId, [FromBody] CreateEmployeeCompensationDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var result = await _payrollService.CreateEmployeeCompensationAsync(employeeId, dto);
        return Created(string.Empty, result);
    }

    [HttpPut("compensation/line/{id:guid}")]
    public async Task<IActionResult> UpdateCompensation(Guid id, [FromBody] UpdateEmployeeCompensationDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.UpdateEmployeeCompensationAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("compensation/line/{id:guid}")]
    public async Task<IActionResult> DeleteCompensation(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var ok = await _payrollService.DeleteEmployeeCompensationAsync(id);
        return ok ? NoContent() : NotFound();
    }

    // ── Salary Revisions ─────────────────────────────────────────────

    [HttpGet("revisions")]
    public async Task<IActionResult> GetRevisions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        return Ok(await _payrollService.GetRevisionsAsync(page, pageSize));
    }

    [HttpPost("revisions")]
    public async Task<IActionResult> CreateRevision([FromBody] CreateSalaryRevisionDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.CreateRevisionAsync(dto);
        return Created(string.Empty, result);
    }

    [HttpPut("revisions/{id:guid}/approve")]
    public async Task<IActionResult> ApproveRevision(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var userName = User.Identity?.Name ?? "System";
        try
        {
            var result = await _payrollService.ApproveRevisionAsync(id, userName);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("revisions/{id:guid}/reject")]
    public async Task<IActionResult> RejectRevision(Guid id, [FromBody] RejectRevisionRequest request)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var userName = User.Identity?.Name ?? "System";
        try
        {
            var result = await _payrollService.RejectRevisionAsync(id, userName, request.Remarks);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Payroll Batches ──────────────────────────────────────────────

    [HttpGet("batches")]
    public async Task<IActionResult> GetBatches([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (!PayrollAccessHelper.CanAccessPayrollBatchListing(User))
            return Forbid();
        return Ok(await _payrollService.GetBatchesAsync(page, pageSize));
    }

    [HttpGet("batches/{id:guid}")]
    public async Task<IActionResult> GetBatch(Guid id)
    {
        if (!PayrollAccessHelper.CanAccessPayrollBatchListing(User))
            return Forbid();
        var result = await _payrollService.GetBatchByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("batches")]
    public async Task<IActionResult> CreateBatch([FromBody] CreatePayrollBatchDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var result = await _payrollService.CreateBatchAsync(dto);
        return Created(string.Empty, result);
    }

    [HttpPut("batches/{id:guid}")]
    public async Task<IActionResult> UpdateBatch(Guid id, [FromBody] UpdatePayrollBatchDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        try
        {
            var result = await _payrollService.UpdateBatchAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("active-employees")]
    public async Task<IActionResult> GetActiveEmployees()
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var employees = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Grade)
            .Include(e => e.Location)
            .Where(e => e.Status != "Terminated")
            .OrderBy(e => e.FirstName).ThenBy(e => e.LastName)
            .ToListAsync();

        return Ok(employees.Select(e => new {
            e.Id,
            e.EmployeeCode,
            e.FirstName,
            e.LastName,
            department = e.Department?.Name ?? "",
            grade = e.Grade?.Name ?? "",
            location = e.Location?.Name ?? "",
        }));
    }

    [HttpGet("eligible-employees")]
    public async Task<IActionResult> GetEligibleEmployees()
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var employeesWithComp = await _db.EmployeeCompensations
            .Where(ec => ec.IsActive && (ec.EffectiveTo == null || ec.EffectiveTo >= DateTime.UtcNow))
            .Select(ec => ec.EmployeeId)
            .Distinct()
            .ToListAsync();

        var employees = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Grade)
            .Include(e => e.Location)
            .Where(e => e.Status != "Terminated" && employeesWithComp.Contains(e.Id))
            .OrderBy(e => e.FirstName).ThenBy(e => e.LastName)
            .ToListAsync();

        return Ok(employees.Select(e => new {
            e.Id,
            e.EmployeeCode,
            e.FirstName,
            e.LastName,
            department = e.Department?.Name ?? "",
            grade = e.Grade?.Name ?? "",
            location = e.Location?.Name ?? "",
        }));
    }

    [HttpPost("batches/{id:guid}/calculate")]
    public async Task<IActionResult> CalculateBatch(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        try
        {
            await _payrollService.ReconcileSalaryAdvanceDeductionLinesForBatchAsync(id);
            await _engine.CalculateBatchAsync(id);
            var result = await _payrollService.GetBatchByIdAsync(id);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("batches/{id:guid}/approve")]
    public async Task<IActionResult> ApproveBatch(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var batch = await _db.PayrollBatches.FindAsync(id);
        if (batch is null) return NotFound();
        if (batch.Status != BatchStatus.Calculated && batch.Status != BatchStatus.Reviewed)
            return BadRequest(new { message = $"Batch must be in Calculated or Reviewed status. Current: {batch.Status}" });

        batch.Status = BatchStatus.Approved;
        batch.ApprovedBy = User.Identity?.Name ?? "System";
        await _db.SaveChangesAsync();
        return Ok(await _payrollService.GetBatchByIdAsync(id));
    }

    [HttpPut("batches/{id:guid}/finalize")]
    public async Task<IActionResult> FinalizeBatch(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var batch = await _db.PayrollBatches
            .Include(b => b.PayStatements)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (batch is null) return NotFound();
        if (batch.Status != BatchStatus.Approved)
            return BadRequest(new { message = $"Batch must be Approved before finalizing. Current: {batch.Status}" });

        batch.Status = BatchStatus.Finalized;
        foreach (var stmt in batch.PayStatements)
            stmt.Status = PayStatementStatus.Finalized;
        await _db.SaveChangesAsync();
        return Ok(await _payrollService.GetBatchByIdAsync(id));
    }

    [HttpDelete("batches/{id:guid}")]
    public async Task<IActionResult> DeleteBatch(Guid id)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        var ok = await _payrollService.DeleteBatchAsync(id);
        return ok ? NoContent() : BadRequest(new { message = "Only Draft batches can be deleted." });
    }

    // ── Pay Statements ───────────────────────────────────────────────

    [HttpGet("statements")]
    public async Task<IActionResult> GetStatements([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? employeeId = null)
    {
        IReadOnlyList<Guid>? allowedIds;
        Guid? filterEmployeeId = employeeId;

        if (PayrollAccessHelper.HasPayrollAllScope(User))
        {
            if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
                return Forbid();
            allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        }
        else
        {
            var selfId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!selfId.HasValue)
                return Forbid();
            if (!PayrollAccessHelper.HasPayrollOwnScope(User))
                return Forbid();
            allowedIds = new[] { selfId.Value };
            filterEmployeeId = selfId;
        }

        return Ok(await _payrollService.GetStatementsAsync(page, pageSize, filterEmployeeId, allowedIds));
    }

    [HttpGet("statements/{id:guid}")]
    public async Task<IActionResult> GetStatement(Guid id)
    {
        var result = await _payrollService.GetStatementByIdAsync(id);
        if (result is null)
            return NotFound();
        if (PayrollAccessHelper.HasPayrollAllScope(User))
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, result.EmployeeId, "Read"))
                return Forbid();
        }
        else
        {
            if (!PayrollAccessHelper.HasPayrollOwnScope(User))
                return Forbid();
            var selfId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!selfId.HasValue || result.EmployeeId != selfId.Value)
                return Forbid();
        }
        return Ok(result);
    }

    [HttpGet("statements/employee/{employeeId:guid}")]
    public async Task<IActionResult> GetStatementsByEmployee(Guid employeeId)
    {
        if (PayrollAccessHelper.HasPayrollAllScope(User))
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
                return Forbid();
        }
        else
        {
            if (!PayrollAccessHelper.HasPayrollOwnScope(User))
                return Forbid();
            var selfId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!selfId.HasValue || employeeId != selfId.Value)
                return Forbid();
        }
        return Ok(await _payrollService.GetStatementsByEmployeeAsync(employeeId));
    }

    // ── Payroll Settings ─────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        return Ok(await _payrollService.GetPayrollSettingsAsync());
    }

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] PayrollSettingsDto dto)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        return Ok(await _payrollService.UpdatePayrollSettingsAsync(dto));
    }

    // ── Salary advance requests ───────────────────────────────────────

    [HttpGet("advance-requests/active-batches")]
    public async Task<IActionResult> GetActiveAdvanceBatches()
    {
        if (!PayrollAccessHelper.CanAccessPayrollBatchListing(User))
            return Forbid();
        return Ok(await _payrollService.GetActivePayrunBatchOptionsForAdvanceAsync());
    }

    [HttpGet("advance-requests/my")]
    public async Task<IActionResult> GetMyAdvanceRequests()
    {
        if (!PayrollAccessHelper.CanUseSalaryAdvanceEmployeeApis(User))
            return Forbid();
        var empId = LeaveAccessHelper.GetCurrentEmployeeId(User);
        if (!empId.HasValue)
            return BadRequest(new { message = "Your account must be linked to an employee to use salary advances." });
        return Ok(await _payrollService.GetSalaryAdvanceRequestsForEmployeeAsync(empId.Value));
    }

    [HttpPost("advance-requests")]
    public async Task<IActionResult> CreateAdvanceRequest([FromBody] CreateSalaryAdvanceRequestDto dto)
    {
        Guid targetEmployeeId;
        var surrogate = dto.EmployeeId.HasValue && dto.EmployeeId.Value != Guid.Empty;

        if (surrogate)
        {
            if (!PayrollAccessHelper.HasPayrollAllScope(User) && !PayrollAccessHelper.CanManageSalaryAdvanceApprovals(User))
                return Forbid();
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, dto.EmployeeId!.Value, "Read"))
                return Forbid();
            targetEmployeeId = dto.EmployeeId.Value;
        }
        else
        {
            if (!PayrollAccessHelper.CanUseSalaryAdvanceEmployeeApis(User))
                return Forbid();
            var empId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!empId.HasValue)
            {
                return BadRequest(new
                {
                    message = "Your account must be linked to an employee to submit for yourself. As HR/payroll admin, choose an employee in the request form.",
                });
            }
            targetEmployeeId = empId.Value;
        }

        try
        {
            var created = await _payrollService.CreateSalaryAdvanceRequestAsync(targetEmployeeId, dto);
            return Created(string.Empty, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("advance-requests/hr-queue")]
    public async Task<IActionResult> GetHrAdvanceQueue([FromQuery] string? status = null)
    {
        if (!PayrollAccessHelper.CanManageSalaryAdvanceApprovals(User))
            return Forbid();

        var allowed = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _payrollService.GetSalaryAdvanceRequestsForHrAsync(status, allowed));
    }

    [HttpPost("advance-requests/{id:guid}/approve")]
    public async Task<IActionResult> ApproveAdvanceRequest(Guid id)
    {
        if (!PayrollAccessHelper.CanManageSalaryAdvanceApprovals(User))
            return Forbid();
        try
        {
            var userName = User.Identity?.Name
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? "HR";
            var result = await _payrollService.ApproveSalaryAdvanceRequestAsync(id, userName);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("advance-requests/{id:guid}/reject")]
    public async Task<IActionResult> RejectAdvanceRequest(Guid id, [FromBody] RejectSalaryAdvanceRequestDto? dto)
    {
        if (!PayrollAccessHelper.CanManageSalaryAdvanceApprovals(User))
            return Forbid();
        try
        {
            var userName = User.Identity?.Name
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue(ClaimTypes.Name)
                ?? "HR";
            var result = await _payrollService.RejectSalaryAdvanceRequestAsync(id, userName, dto?.Reason);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ── Bulk Import ───────────────────────────────────────────────────

    [HttpGet("compensation/import-template")]
    public async Task<IActionResult> DownloadImportTemplate([FromQuery] string? category = null)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        ComponentCategory? catEnum = category != null && Enum.TryParse<ComponentCategory>(category, true, out var parsed) ? parsed : null;

        var components = await _db.CompensationComponents
            .Where(c => c.IsActive && (catEnum == null || c.Category == catEnum))
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        using var wb = new ClosedXML.Excel.XLWorkbook();
        var ws = wb.Worksheets.Add("Compensation");
        ws.Cell(1, 1).Value = "EmployeeCode";
        ws.Cell(1, 1).Style.Font.Bold = true;

        for (int i = 0; i < components.Count; i++)
        {
            ws.Cell(1, i + 2).Value = components[i].Code;
            ws.Cell(1, i + 2).Style.Font.Bold = true;
        }

        ws.Columns().AdjustToContents();

        var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"compensation_template_{(category ?? "all").ToLower()}.xlsx");
    }

    [HttpPost("compensation/import")]
    public async Task<IActionResult> ImportCompensation(IFormFile file, [FromQuery] string? effectiveFrom = null, [FromQuery] Guid? batchId = null)
    {
        if (!PayrollAccessHelper.HasPayrollAllScope(User))
            return Forbid();
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var effDate = DateTime.TryParse(effectiveFrom, out var d) ? d : DateTime.UtcNow;

        using var stream = file.OpenReadStream();
        using var wb = new ClosedXML.Excel.XLWorkbook(stream);
        var ws = wb.Worksheets.First();

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 1;

        var componentCodes = new List<string>();
        for (int col = 2; col <= lastCol; col++)
            componentCodes.Add(ws.Cell(1, col).GetString().Trim());

        var components = await _db.CompensationComponents
            .Where(c => c.IsActive)
            .ToListAsync();
        var codeMap = components.ToDictionary(c => c.Code, c => c, StringComparer.OrdinalIgnoreCase);

        var employees = await _db.Employees.Where(e => e.Status != "Terminated").ToListAsync();
        var empCodeMap = employees.ToDictionary(e => e.EmployeeCode, e => e, StringComparer.OrdinalIgnoreCase);

        var existing = await _db.EmployeeCompensations
            .Where(ec => ec.IsActive && ec.BatchId == batchId)
            .ToListAsync();
        var existingLookup = existing.ToLookup(ec => (ec.EmployeeId, ec.ComponentId));

        int created = 0, updated = 0, skipped = 0;
        var errors = new List<string>();

        for (int row = 2; row <= lastRow; row++)
        {
            var empCode = ws.Cell(row, 1).GetString().Trim();
            if (string.IsNullOrEmpty(empCode)) continue;

            if (!empCodeMap.TryGetValue(empCode, out var employee))
            {
                errors.Add($"Row {row}: Employee '{empCode}' not found");
                skipped++;
                continue;
            }

            for (int ci = 0; ci < componentCodes.Count; ci++)
            {
                var cellValue = ws.Cell(row, ci + 2).GetString().Trim();
                if (string.IsNullOrEmpty(cellValue)) continue;

                if (!decimal.TryParse(cellValue, out var amount))
                {
                    errors.Add($"Row {row}, {componentCodes[ci]}: Invalid amount '{cellValue}'");
                    skipped++;
                    continue;
                }

                if (!codeMap.TryGetValue(componentCodes[ci], out var comp))
                {
                    errors.Add($"Row {row}: Component '{componentCodes[ci]}' not found");
                    skipped++;
                    continue;
                }

                var existingComp = existingLookup[(employee.Id, comp.Id)].FirstOrDefault();
                if (existingComp != null)
                {
                    existingComp.Amount = amount;
                    existingComp.EffectiveFrom = effDate;
                    updated++;
                }
                else
                {
                    _db.EmployeeCompensations.Add(new EmployeeCompensation
                    {
                        EmployeeId = employee.Id,
                        ComponentId = comp.Id,
                        Amount = amount,
                        Currency = "LKR",
                        EffectiveFrom = effDate,
                        IsActive = true,
                        BatchId = batchId,
                    });
                    created++;
                }
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new { created, updated, skipped, errors = errors.Take(20) });
    }
}

public class RejectRevisionRequest
{
    public string? Remarks { get; set; }
}
