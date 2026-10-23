using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
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
    private readonly IPayrollAttendanceImportService _attendanceImport;
    private readonly PayrollCalculationEngine _engine;
    private readonly AppDbContext _db;
    private readonly IBusinessClock _clock;

    public PayrollController(
        IPayrollService payrollService,
        IPayrollAttendanceImportService attendanceImport,
        PayrollCalculationEngine engine,
        AppDbContext db,
        IBusinessClock clock)
    {
        _payrollService = payrollService;
        _attendanceImport = attendanceImport;
        _engine = engine;
        _db = db;
        _clock = clock;
    }

    // ── Compensation Components ──────────────────────────────────────

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents()
        => Ok(await _payrollService.GetComponentsAsync());

    [HttpGet("components/{id:guid}")]
    public async Task<IActionResult> GetComponent(Guid id)
    {
        var result = await _payrollService.GetComponentByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("components")]
    public async Task<IActionResult> CreateComponent([FromBody] CreateComponentDto dto)
    {
        var result = await _payrollService.CreateComponentAsync(dto);
        return CreatedAtAction(nameof(GetComponent), new { id = result.Id }, result);
    }

    [HttpPut("components/{id:guid}")]
    public async Task<IActionResult> UpdateComponent(Guid id, [FromBody] UpdateComponentDto dto)
    {
        var result = await _payrollService.UpdateComponentAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("components/{id:guid}")]
    public async Task<IActionResult> DeleteComponent(Guid id)
    {
        var ok = await _payrollService.DeleteComponentAsync(id);
        return ok ? NoContent() : NotFound();
    }

    // ── Variable Compensation (batch-level view) ───────────────────

    [HttpGet("compensation/variable")]
    public async Task<IActionResult> GetVariableCompensation([FromQuery] Guid batchId, [FromQuery] Guid? componentId = null)
    {
        var batch = await _db.PayrollBatches.FindAsync(batchId);
        if (batch is null) return NotFound(new { message = "Batch not found." });

        var categoryFilter = batch.ProcessType switch
        {
            PayrollProcessType.Bonus => ComponentCategory.OneTime,
            PayrollProcessType.OtherTransactions => ComponentCategory.Variable,
            _ => ComponentCategory.Variable,
        };

        var query = _db.EmployeeCompensations
            .Include(ec => ec.Employee)
            .Include(ec => ec.Component)
            .Where(ec => ec.BatchId == batchId && ec.IsActive && ec.Component.Category == categoryFilter);

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
        if (request.Updates is null || request.Updates.Count == 0)
            return BadRequest(new { message = "No updates provided." });

        var ids = request.Updates.Select(u => u.Id).ToList();
        var entities = await _db.EmployeeCompensations
            .Where(ec => ids.Contains(ec.Id))
            .ToListAsync();

        foreach (var entity in entities)
        {
            var upd = request.Updates.FirstOrDefault(u => u.Id == entity.Id);
            if (upd != null) entity.Amount = Math.Round(upd.Amount, 2);
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

    [HttpGet("compensation/{employeeId:guid}/apit-summary")]
    public async Task<IActionResult> GetApitSummary(
        Guid employeeId, [FromQuery] string? taxMode = null, [FromQuery] int? month = null)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _payrollService.GetEmployeeApitSummaryAsync(employeeId, taxMode, month));
    }

    [HttpPut("compensation/{employeeId:guid}/apit-tax-mode")]
    public async Task<IActionResult> UpdateApitTaxMode(
        Guid employeeId, [FromBody] UpdateEmployeeApitTaxModeDto dto)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        try
        {
            return Ok(await _payrollService.UpdateEmployeeApitTaxModeAsync(employeeId, dto.ApitTaxMode));
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpPost("compensation/{employeeId:guid}")]
    public async Task<IActionResult> CreateCompensation(Guid employeeId, [FromBody] CreateEmployeeCompensationDto dto)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var result = await _payrollService.CreateEmployeeCompensationAsync(employeeId, dto);
        var recalculated = dto.BatchId is Guid batchId
            ? await _engine.TryRecalculateOpenBatchAsync(batchId)
            : await _engine.TryRecalculateOpenSalaryBatchesForEmployeeAsync(employeeId);
        return Created(string.Empty, new { result, recalculatedBatches = recalculated });
    }

    [HttpPut("compensation/line/{id:guid}")]
    public async Task<IActionResult> UpdateCompensation(Guid id, [FromBody] UpdateEmployeeCompensationDto dto)
    {
        var result = await _payrollService.UpdateEmployeeCompensationAsync(id, dto);
        if (result is null) return NotFound();
        var recalculated = result.BatchId is Guid batchId
            ? await _engine.TryRecalculateOpenBatchAsync(batchId)
            : await _engine.TryRecalculateOpenSalaryBatchesForEmployeeAsync(result.EmployeeId);
        return Ok(new { result, recalculatedBatches = recalculated });
    }

    [HttpDelete("compensation/line/{id:guid}")]
    public async Task<IActionResult> DeleteCompensation(Guid id)
    {
        var line = await _db.EmployeeCompensations.AsNoTracking()
            .FirstOrDefaultAsync(ec => ec.Id == id);
        if (line is null) return NotFound();
        var ok = await _payrollService.DeleteEmployeeCompensationAsync(id);
        if (!ok) return NotFound();
        var recalculated = line.BatchId is Guid batchId
            ? await _engine.TryRecalculateOpenBatchAsync(batchId)
            : await _engine.TryRecalculateOpenSalaryBatchesForEmployeeAsync(line.EmployeeId);
        return Ok(new { recalculatedBatches = recalculated });
    }

    // ── Salary Revisions ─────────────────────────────────────────────

    [HttpGet("revisions")]
    public async Task<IActionResult> GetRevisions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _payrollService.GetRevisionsAsync(page, pageSize));

    [HttpPost("revisions")]
    public async Task<IActionResult> CreateRevision([FromBody] CreateSalaryRevisionDto dto)
    {
        var result = await _payrollService.CreateRevisionAsync(dto);
        return Created(string.Empty, result);
    }

    [HttpPut("revisions/{id:guid}/approve")]
    public async Task<IActionResult> ApproveRevision(Guid id)
    {
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
        => Ok(await _payrollService.GetBatchesAsync(page, pageSize));

    [HttpGet("batches/{id:guid}")]
    public async Task<IActionResult> GetBatch(Guid id)
    {
        var result = await _payrollService.GetBatchByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("batches")]
    public async Task<IActionResult> CreateBatch([FromBody] CreatePayrollBatchDto dto)
    {
        try
        {
            var result = await _payrollService.CreateBatchAsync(dto);
            return Created(string.Empty, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("active-employees")]
    public async Task<IActionResult> GetActiveEmployees()
    {
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
            employmentType = e.EmploymentType,
            department = e.Department?.Name ?? "",
            grade = e.Grade?.Name ?? "",
            location = e.Location?.Name ?? "",
        }));
    }

    [HttpGet("eligible-employees")]
    public async Task<IActionResult> GetEligibleEmployees(
        [FromQuery] int? month = null,
        [FromQuery] int? year = null,
        [FromQuery] string? processType = null)
    {
        var employees = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.Grade)
            .Include(e => e.Location)
            .Where(e => e.Status != "Terminated")
            .OrderBy(e => e.FirstName).ThenBy(e => e.LastName)
            .ToListAsync();

        var alreadyInPeriod = new HashSet<Guid>();
        if (month is > 0 and <= 12
            && year is >= 2000
            && Enum.TryParse<PayrollProcessType>(processType, ignoreCase: true, out var parsedType))
        {
            alreadyInPeriod = await PayrollPeriodOccupancy.GetEmployeeIdsAsync(_db, year.Value, month.Value, parsedType);
        }

        return Ok(employees.Select(e => new {
            e.Id,
            e.EmployeeCode,
            e.FirstName,
            e.LastName,
            department = e.Department?.Name ?? "",
            grade = e.Grade?.Name ?? "",
            location = e.Location?.Name ?? "",
            alreadyInBatch = alreadyInPeriod.Contains(e.Id),
        }));
    }

    [HttpGet("batches/{id:guid}/statements")]
    public async Task<IActionResult> GetBatchStatements(Guid id)
    {
        var batch = await _db.PayrollBatches.FindAsync(id);
        if (batch is null) return NotFound();
        return Ok(await _payrollService.GetStatementsByBatchAsync(id));
    }

    [HttpGet("batches/{id:guid}/bank-slips")]
    public async Task<IActionResult> GetBatchBankSlips(Guid id)
    {
        var batch = await _db.PayrollBatches.FindAsync(id);
        if (batch is null) return NotFound();

        var statements = await _db.PayStatements
            .Include(p => p.Employee)
            .Include(p => p.Lines)
            .Where(p => p.BatchId == id)
            .ToListAsync();

        var employeeIds = statements.Select(p => p.EmployeeId).Distinct().ToList();
        var accounts = await _db.BankAccounts
            .Where(b => employeeIds.Contains(b.EmployeeId))
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync();
        var latestAccount = accounts
            .GroupBy(b => b.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First());

        static decimal LineAmount(PayStatement statement, string code) =>
            statement.Lines.Where(l => l.ComponentCode == code).Sum(l => l.Amount);

        static string? FirstNonEmpty(params string?[] values) =>
            values.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

        var rows = statements
            .OrderBy(p => p.Employee.EmployeeCode)
            .Select(p =>
            {
                latestAccount.TryGetValue(p.EmployeeId, out var account);
                return new BankSlipRowDto
                {
                    StatementId = p.Id,
                    EmployeeId = p.EmployeeId,
                    EmployeeName = (p.Employee.FirstName + " " + p.Employee.LastName).Trim(),
                    EmployeeCode = p.Employee.EmployeeCode,
                    Status = p.Status.ToString(),
                    NetPay = p.NetPay,
                    EpfEmployee = LineAmount(p, "EPF_EE"),
                    EpfEmployer = LineAmount(p, "EPF_ER"),
                    EtfEmployer = LineAmount(p, "ETF_ER"),
                    IsCashPayment = p.Employee.IsCashPayment,
                    HasBankAccount = !p.Employee.IsCashPayment
                        && account != null
                        && !string.IsNullOrWhiteSpace(account.AccountNumber),
                    BankName = account?.BankName,
                    AccountNumber = account?.AccountNumber,
                    BankCode = account?.BankCode,
                    BranchCode = account?.BranchCode,
                    BranchLocation = account?.BranchLocation,
                    NationalId = p.Employee.NationalId,
                    Phone = FirstNonEmpty(p.Employee.Phone, p.Employee.WorkTelephone, p.Employee.HomeTelephone),
                    Email = FirstNonEmpty(p.Employee.Email, p.Employee.OtherEmail),
                };
            })
            .ToList();

        return Ok(rows);
    }

    [HttpPost("batches/sync-from-employee-salary")]
    public async Task<IActionResult> SyncAllBatchesFromEmployeeSalary()
    {
        var (recalculated, errors) = await _engine.TryRecalculateAllOpenSalaryBatchesAsync();
        if (recalculated == 0 && errors.Count > 0)
            return BadRequest(new { message = errors[0], recalculated, errors });

        return Ok(new
        {
            recalculated,
            errors,
            message = recalculated > 0
                ? $"Updated pay slips for {recalculated} payroll run(s) from Employee Salary, including APIT from each salary."
                : "No salary batches to update.",
        });
    }

    [HttpPost("batches/{id:guid}/calculate")]
    public async Task<IActionResult> CalculateBatch(Guid id)
    {
        try
        {
            var batch = await _engine.CalculateBatchAsync(id);
            var result = await _payrollService.GetBatchByIdAsync(id);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            var inner = ex.InnerException?.Message ?? ex.Message;
            return BadRequest(new { message = $"Payroll calculation could not be saved: {inner}" });
        }
    }

    [HttpGet("batches/{id:guid}/import-attendance-leave/preview")]
    public async Task<IActionResult> PreviewAttendanceLeaveImport(Guid id)
    {
        try
        {
            return Ok(await _attendanceImport.PreviewImportAsync(id));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("batches/{id:guid}/import-attendance-leave")]
    public async Task<IActionResult> ImportAttendanceLeave(Guid id)
    {
        try
        {
            return Ok(await _attendanceImport.ImportAsync(id));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("batches/{id:guid}/worked-hours")]
    public async Task<IActionResult> GetEmployeeWorkedHours(Guid id, [FromQuery] Guid employeeId)
    {
        if (employeeId == Guid.Empty)
            return BadRequest(new { message = "employeeId is required." });
        try
        {
            return Ok(await _attendanceImport.GetEmployeeWorkedHoursAsync(id, employeeId));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("batches/{id:guid}/review")]
    public async Task<IActionResult> ReviewBatch(Guid id)
    {
        try
        {
            var result = await _payrollService.ReviewBatchAsync(id, User.Identity?.Name ?? "System");
            return result is null ? NotFound(new { message = "Batch not found." }) : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("batches/{id:guid}/return")]
    public async Task<IActionResult> ReturnBatch(Guid id)
    {
        try
        {
            var result = await _payrollService.ReturnBatchToCalculatedAsync(id);
            return result is null ? NotFound(new { message = "Batch not found." }) : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("batches/{id:guid}/approve")]
    public async Task<IActionResult> ApproveBatch(Guid id)
    {
        try
        {
            var result = await _payrollService.ApproveBatchAsync(id, User.Identity?.Name ?? "System");
            return result is null ? NotFound(new { message = "Batch not found." }) : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("batches/{id:guid}/finalize")]
    public async Task<IActionResult> FinalizeBatch(Guid id)
    {
        try
        {
            var result = await _payrollService.FinalizeBatchAsync(id);
            return result is null ? NotFound(new { message = "Batch not found." }) : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("batches/{id:guid}")]
    public async Task<IActionResult> DeleteBatch(Guid id)
    {
        return await _payrollService.DeleteBatchAsync(id) switch
        {
            DeletePayrollBatchOutcome.Deleted => NoContent(),
            DeletePayrollBatchOutcome.NotFound => NotFound(new { message = "Batch not found." }),
            DeletePayrollBatchOutcome.NotAllowed => BadRequest(new { message = "Only draft or pending-review batches can be deleted." }),
            _ => BadRequest(new { message = "Could not delete batch." }),
        };
    }

    // ── Pay Statements ───────────────────────────────────────────────

    [HttpGet("statements")]
    public async Task<IActionResult> GetStatements(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] string? search = null,
        [FromQuery] Guid? batchId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _payrollService.GetStatementsAsync(page, pageSize, employeeId, search, allowedIds, batchId));
    }

    [HttpGet("statements/{id:guid}")]
    public async Task<IActionResult> GetStatement(Guid id)
    {
        var result = await _payrollService.GetStatementByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("statements/employee/{employeeId:guid}")]
    public async Task<IActionResult> GetStatementsByEmployee(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _payrollService.GetStatementsByEmployeeAsync(employeeId));
    }

    // ── Payroll Settings ─────────────────────────────────────────────

    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings()
        => Ok(await _payrollService.GetPayrollSettingsAsync());

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] PayrollSettingsDto dto)
    {
        try
        {
            return Ok(await _payrollService.UpdatePayrollSettingsAsync(dto));
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
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var effDate = ExcelImportDateParser.ParseWallDate(effectiveFrom) ?? _clock.Now.Date;

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
