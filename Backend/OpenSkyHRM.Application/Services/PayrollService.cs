using System.Globalization;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class PayrollService : IPayrollService
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;

    public PayrollService(AppDbContext db, ISystemSettingService settings)
    {
        _db = db;
        _settings = settings;
    }

    // ── Compensation Components ──────────────────────────────────────

    public async Task<List<CompensationComponentDto>> GetComponentsAsync()
    {
        await PayrollComponentSeeder.EnsureAsync(_db);
        return await _db.CompensationComponents.OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => MapComponentDto(c)).ToListAsync();
    }

    public async Task<CompensationComponentDto?> GetComponentByIdAsync(Guid id)
    {
        var c = await _db.CompensationComponents.FindAsync(id);
        return c is null ? null : MapComponentDto(c);
    }

    public async Task<CompensationComponentDto> CreateComponentAsync(CreateComponentDto dto)
    {
        var entity = new CompensationComponent
        {
            Name = dto.Name,
            Code = dto.Code.ToUpperInvariant(),
            Type = ParseComponentType(dto.Type),
            Category = Enum.Parse<ComponentCategory>(dto.Category),
            IsTaxable = dto.IsTaxable,
            IsEpfApplicable = dto.IsEpfApplicable,
            IsEtfApplicable = dto.IsEtfApplicable,
            IsStatutory = dto.IsStatutory,
            Description = dto.Description,
            FormulaExpression = dto.FormulaExpression,
            DependsOnComponentCode = dto.DependsOnComponentCode,
            SortOrder = dto.SortOrder,
            IsEmployerContribution = dto.IsEmployerContribution,
        };
        _db.CompensationComponents.Add(entity);
        await _db.SaveChangesAsync();
        return MapComponentDto(entity);
    }

    public async Task<CompensationComponentDto?> UpdateComponentAsync(Guid id, UpdateComponentDto dto)
    {
        var entity = await _db.CompensationComponents.FindAsync(id);
        if (entity is null) return null;

        entity.Name = dto.Name;
        entity.Code = dto.Code.ToUpperInvariant();
        entity.Type = ParseComponentType(dto.Type);
        entity.Category = Enum.Parse<ComponentCategory>(dto.Category);
        entity.IsTaxable = dto.IsTaxable;
        entity.IsEpfApplicable = dto.IsEpfApplicable;
        entity.IsEtfApplicable = dto.IsEtfApplicable;
        entity.IsStatutory = dto.IsStatutory;
        entity.IsActive = dto.IsActive;
        entity.Description = dto.Description;
        entity.FormulaExpression = dto.FormulaExpression;
        entity.DependsOnComponentCode = dto.DependsOnComponentCode;
        entity.SortOrder = dto.SortOrder;
        entity.IsEmployerContribution = dto.IsEmployerContribution;

        await _db.SaveChangesAsync();
        return MapComponentDto(entity);
    }

    public async Task<bool> DeleteComponentAsync(Guid id)
    {
        var entity = await _db.CompensationComponents.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Employee Compensation ────────────────────────────────────────

    public async Task<List<EmployeeCompensationDto>> GetEmployeeCompensationAsync(Guid employeeId)
    {
        return await _db.EmployeeCompensations
            .Include(ec => ec.Employee).Include(ec => ec.Component)
            .Where(ec => ec.EmployeeId == employeeId)
            .OrderBy(ec => ec.Component.SortOrder)
            .Select(ec => new EmployeeCompensationDto
            {
                Id = ec.Id, EmployeeId = ec.EmployeeId,
                EmployeeName = ec.Employee.FirstName + " " + ec.Employee.LastName,
                ComponentId = ec.ComponentId,
                ComponentName = ec.Component.Name, ComponentCode = ec.Component.Code,
                ComponentType = ec.Component.Type.ToString(),
                ComponentCategory = ec.Component.Category.ToString(),
                IsTaxable = ec.Component.IsTaxable,
                IsEpfApplicable = ec.Component.IsEpfApplicable,
                IsEtfApplicable = ec.Component.IsEtfApplicable,
                Amount = ec.Amount, Currency = ec.Currency,
                EffectiveFrom = ec.EffectiveFrom, EffectiveTo = ec.EffectiveTo,
                IsActive = ec.IsActive, BatchId = ec.BatchId,
            }).ToListAsync();
    }

    public async Task<EmployeeApitSummaryDto> GetEmployeeApitSummaryAsync(
        Guid employeeId, string? taxMode, int? calendarMonth)
    {
        var lines = await GetEmployeeCompensationAsync(employeeId);
        var today = DateTime.Today;
        var monthlySalary = lines
            .Where(l => l.IsActive && l.BatchId == null
                && !string.Equals(l.ComponentCategory, "OneTime", StringComparison.OrdinalIgnoreCase)
                && (PayrollCalculationEngine.IsEarningComponentType(l.ComponentType)
                    || PayrollCalculationEngine.IsBasicComponentCode(l.ComponentCode)))
            .GroupBy(l => l.ComponentId)
            .Select(g => g.OrderByDescending(l => l.EffectiveFrom).First())
            .Where(l => l.Amount > 0 && (l.EffectiveTo == null || l.EffectiveTo.Value.Date >= today))
            .Sum(l => l.Amount);

        var settings = await GetPayrollSettingsAsync();
        string? employeeTaxMode = null;
        try
        {
            var employee = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == employeeId);
            employeeTaxMode = employee?.ApitTaxMode;
        }
        catch (Exception)
        {
            // Live tenant may not have Employees.ApitTaxMode until schema repair / migration finishes.
        }
        var mode = PayrollCalculationEngine.NormalizeApitTaxMode(
            taxMode ?? employeeTaxMode ?? settings.ApitTaxMode);
        var month = calendarMonth is >= 1 and <= 12 ? calendarMonth.Value : today.Month;
        var taxYearStartYear = PayrollCalculationEngine.ApitTaxYearStartYear(today.Month, today.Year);
        decimal cumulativeTaxable = 0m;
        decimal? storedCumulativeApit = null;
        try
        {
            var balance = await _db.EmployeeApitYearBalances.AsNoTracking()
                .FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.TaxYearStartYear == taxYearStartYear);
            cumulativeTaxable = balance?.CumulativeTaxable ?? 0m;
            storedCumulativeApit = balance?.CumulativeApit;
        }
        catch (Exception)
        {
            // Live tenant may not have the table until schema repair / migration finishes.
        }
        var cumulativeApit = storedCumulativeApit
            ?? PayrollCalculationEngine.CalculateApitTableAnnual(cumulativeTaxable);
        var monthlyApit = PayrollCalculationEngine.CalculateApit(monthlySalary);
        var annualApit = PayrollCalculationEngine.CalculateApitTableAnnual(cumulativeTaxable);
        var yearlySalary = Math.Round(monthlySalary * 12m, 2);
        var confirmedMonths = monthlySalary > 0 && cumulativeTaxable > 0
            ? Math.Clamp((int)Math.Round(cumulativeTaxable / monthlySalary, MidpointRounding.AwayFromZero), 0, 11)
            : 0;

        return new EmployeeApitSummaryDto
        {
            MonthlySalary = monthlySalary,
            YearlySalary = yearlySalary,
            MonthlyApit = monthlyApit,
            AnnualApit = annualApit,
            DisplayApit = PayrollCalculationEngine.CalculateApitByMode(
                monthlySalary, 0, month, mode, cumulativeTaxable, confirmedMonths),
            ApitTaxMode = mode,
            BelowMonthlyRelief = monthlySalary > 0 && monthlySalary <= 150_000m,
            TaxYearMonthNumber = PayrollCalculationEngine.ApitTaxYearMonthNumber(month),
            CumulativeTaxable = cumulativeTaxable,
            CumulativeApit = cumulativeApit,
            ConfirmedMonths = confirmedMonths,
        };
    }

    public async Task<EmployeeApitSummaryDto> UpdateEmployeeApitTaxModeAsync(Guid employeeId, string taxMode)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId)
            ?? throw new InvalidOperationException("Employee not found.");
        employee.ApitTaxMode = PayrollCalculationEngine.NormalizeApitTaxMode(taxMode);
        await _db.SaveChangesAsync();
        return await GetEmployeeApitSummaryAsync(employeeId, employee.ApitTaxMode, DateTime.Today.Month);
    }

    public async Task<EmployeeCompensationDto> CreateEmployeeCompensationAsync(Guid employeeId, CreateEmployeeCompensationDto dto)
    {
        var entity = new EmployeeCompensation
        {
            EmployeeId = employeeId,
            ComponentId = dto.ComponentId,
            Amount = dto.Amount,
            Currency = dto.Currency,
            EffectiveFrom = dto.EffectiveFrom,
            EffectiveTo = dto.EffectiveTo,
            BatchId = dto.BatchId,
        };
        _db.EmployeeCompensations.Add(entity);
        await _db.SaveChangesAsync();

        await _db.Entry(entity).Reference(e => e.Employee).LoadAsync();
        await _db.Entry(entity).Reference(e => e.Component).LoadAsync();

        return new EmployeeCompensationDto
        {
            Id = entity.Id, EmployeeId = entity.EmployeeId,
            EmployeeName = entity.Employee.FirstName + " " + entity.Employee.LastName,
            ComponentId = entity.ComponentId,
            ComponentName = entity.Component.Name, ComponentCode = entity.Component.Code,
            ComponentType = entity.Component.Type.ToString(),
            ComponentCategory = entity.Component.Category.ToString(),
            IsTaxable = entity.Component.IsTaxable,
            IsEpfApplicable = entity.Component.IsEpfApplicable,
            IsEtfApplicable = entity.Component.IsEtfApplicable,
            Amount = entity.Amount, Currency = entity.Currency,
            EffectiveFrom = entity.EffectiveFrom, EffectiveTo = entity.EffectiveTo,
            IsActive = entity.IsActive, BatchId = entity.BatchId,
        };
    }

    public async Task<EmployeeCompensationDto?> UpdateEmployeeCompensationAsync(Guid id, UpdateEmployeeCompensationDto dto)
    {
        var entity = await _db.EmployeeCompensations
            .Include(ec => ec.Employee).Include(ec => ec.Component)
            .FirstOrDefaultAsync(ec => ec.Id == id);
        if (entity is null) return null;

        entity.Amount = dto.Amount;
        entity.Currency = dto.Currency;
        entity.EffectiveFrom = dto.EffectiveFrom;
        entity.EffectiveTo = dto.EffectiveTo;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();

        return new EmployeeCompensationDto
        {
            Id = entity.Id, EmployeeId = entity.EmployeeId,
            EmployeeName = entity.Employee.FirstName + " " + entity.Employee.LastName,
            ComponentId = entity.ComponentId,
            ComponentName = entity.Component.Name, ComponentCode = entity.Component.Code,
            ComponentType = entity.Component.Type.ToString(),
            ComponentCategory = entity.Component.Category.ToString(),
            IsTaxable = entity.Component.IsTaxable,
            IsEpfApplicable = entity.Component.IsEpfApplicable,
            IsEtfApplicable = entity.Component.IsEtfApplicable,
            Amount = entity.Amount, Currency = entity.Currency,
            EffectiveFrom = entity.EffectiveFrom, EffectiveTo = entity.EffectiveTo,
            IsActive = entity.IsActive, BatchId = entity.BatchId,
        };
    }

    public async Task<bool> DeleteEmployeeCompensationAsync(Guid id)
    {
        var entity = await _db.EmployeeCompensations.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Salary Revisions ─────────────────────────────────────────────

    public async Task<PagedResult<SalaryRevisionDto>> GetRevisionsAsync(int page = 1, int pageSize = 20)
    {
        var query = _db.SalaryRevisions.Include(s => s.Employee).AsQueryable();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(s => s.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new SalaryRevisionDto
            {
                Id = s.Id, EmployeeId = s.EmployeeId,
                EmployeeName = s.Employee.FirstName + " " + s.Employee.LastName,
                RevisionType = s.RevisionType, CurrentSalary = s.CurrentSalary,
                ProposedSalary = s.ProposedSalary, ChangePercentage = s.ChangePercentage,
                Justification = s.Justification, Status = s.Status.ToString(),
                EffectiveDate = s.EffectiveDate, ApprovedBy = s.ApprovedBy,
                ApprovedAt = s.ApprovedAt, Remarks = s.Remarks,
            }).ToListAsync();
        return new PagedResult<SalaryRevisionDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<SalaryRevisionDto> CreateRevisionAsync(CreateSalaryRevisionDto dto)
    {
        var change = dto.CurrentSalary > 0
            ? Math.Round((dto.ProposedSalary - dto.CurrentSalary) / dto.CurrentSalary * 100, 2)
            : 0;

        var entity = new SalaryRevision
        {
            EmployeeId = dto.EmployeeId,
            RevisionType = dto.RevisionType,
            CurrentSalary = dto.CurrentSalary,
            ProposedSalary = dto.ProposedSalary,
            ChangePercentage = change,
            Justification = dto.Justification,
            EffectiveDate = dto.EffectiveDate,
        };
        _db.SalaryRevisions.Add(entity);
        await _db.SaveChangesAsync();

        await _db.Entry(entity).Reference(e => e.Employee).LoadAsync();
        return new SalaryRevisionDto
        {
            Id = entity.Id, EmployeeId = entity.EmployeeId,
            EmployeeName = entity.Employee.FirstName + " " + entity.Employee.LastName,
            RevisionType = entity.RevisionType, CurrentSalary = entity.CurrentSalary,
            ProposedSalary = entity.ProposedSalary, ChangePercentage = entity.ChangePercentage,
            Justification = entity.Justification, Status = entity.Status.ToString(),
            EffectiveDate = entity.EffectiveDate,
        };
    }

    public async Task<SalaryRevisionDto?> ApproveRevisionAsync(Guid id, string approvedBy)
    {
        var entity = await _db.SalaryRevisions.Include(s => s.Employee).FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return null;
        if (entity.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending salary revisions can be approved.");

        entity.Status = ApprovalStatus.Approved;
        entity.ApprovedBy = approvedBy;
        entity.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new SalaryRevisionDto
        {
            Id = entity.Id, EmployeeId = entity.EmployeeId,
            EmployeeName = entity.Employee.FirstName + " " + entity.Employee.LastName,
            RevisionType = entity.RevisionType, CurrentSalary = entity.CurrentSalary,
            ProposedSalary = entity.ProposedSalary, ChangePercentage = entity.ChangePercentage,
            Justification = entity.Justification, Status = entity.Status.ToString(),
            EffectiveDate = entity.EffectiveDate, ApprovedBy = entity.ApprovedBy,
            ApprovedAt = entity.ApprovedAt, Remarks = entity.Remarks,
        };
    }

    public async Task<SalaryRevisionDto?> RejectRevisionAsync(Guid id, string rejectedBy, string? remarks)
    {
        var entity = await _db.SalaryRevisions.Include(s => s.Employee).FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return null;
        if (entity.Status != ApprovalStatus.Pending)
            throw new InvalidOperationException("Only pending salary revisions can be rejected.");

        entity.Status = ApprovalStatus.Rejected;
        entity.ApprovedBy = rejectedBy;
        entity.ApprovedAt = DateTime.UtcNow;
        entity.Remarks = remarks;
        await _db.SaveChangesAsync();

        return new SalaryRevisionDto
        {
            Id = entity.Id, EmployeeId = entity.EmployeeId,
            EmployeeName = entity.Employee.FirstName + " " + entity.Employee.LastName,
            RevisionType = entity.RevisionType, CurrentSalary = entity.CurrentSalary,
            ProposedSalary = entity.ProposedSalary, ChangePercentage = entity.ChangePercentage,
            Justification = entity.Justification, Status = entity.Status.ToString(),
            EffectiveDate = entity.EffectiveDate, ApprovedBy = entity.ApprovedBy,
            ApprovedAt = entity.ApprovedAt, Remarks = entity.Remarks,
        };
    }

    // ── Payroll Batches ──────────────────────────────────────────────

    public async Task<PagedResult<PayrollBatchDto>> GetBatchesAsync(int page = 1, int pageSize = 20)
    {
        try
        {
            await PayrollSeeder.EnsureStarterBatchAsync(_db);
        }
        catch
        {
            // Never block batch listing if auto-seed fails on a legacy tenant DB.
        }

        var query = _db.PayrollBatches.AsNoTracking().AsQueryable();
        var total = await query.CountAsync();
        var rows = await query
            .OrderByDescending(b => b.CreatedAt)
            .ThenByDescending(b => b.Year)
            .ThenByDescending(b => b.Month)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        var items = rows.Select(MapBatchDto).ToList();
        return new PagedResult<PayrollBatchDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PayrollBatchDto?> GetBatchByIdAsync(Guid id)
    {
        var b = await _db.PayrollBatches.FindAsync(id);
        return b is null ? null : MapBatchDto(b);
    }

    public async Task<PayrollBatchDto> CreateBatchAsync(CreatePayrollBatchDto dto)
    {
        if (!Enum.TryParse<PayrollProcessType>(dto.ProcessType, ignoreCase: true, out var processType))
            throw new InvalidOperationException($"Invalid process type '{dto.ProcessType}'.");

        var (effectiveFrom, effectiveTo) = ResolveBatchEffectiveDates(dto);

        if (dto.EmployeeIds.Count > 0)
        {
            var alreadyInPeriod = await PayrollPeriodOccupancy.GetEmployeeIdsAsync(
                _db, dto.Year, dto.Month, processType);
            var overlap = dto.EmployeeIds.Where(alreadyInPeriod.Contains).Distinct().ToList();
            if (overlap.Count > 0)
            {
                var codes = await _db.Employees.AsNoTracking()
                    .Where(e => overlap.Contains(e.Id))
                    .Select(e => e.EmployeeCode)
                    .ToListAsync();
                var monthName = CultureInfo.InvariantCulture.DateTimeFormat.GetMonthName(dto.Month);
                throw new InvalidOperationException(
                    $"These employees already have a {processType} payroll for {monthName} {dto.Year}: {string.Join(", ", codes)}. " +
                    "Select only employees who are not already in a batch for this month.");
            }
        }

        var prefix = processType switch
        {
            PayrollProcessType.Salary => "SAL",
            PayrollProcessType.Bonus => "BON",
            PayrollProcessType.OtherTransactions => "OTH",
            _ => "PR",
        };

        var count = await _db.PayrollBatches.CountAsync(b =>
            b.Year == dto.Year && b.Month == dto.Month && b.ProcessType == processType) + 1;

        var entity = new PayrollBatch
        {
            BatchCode = $"{prefix}-{dto.Year}-{dto.Month:D2}-{count:D3}",
            Month = dto.Month,
            Year = dto.Year,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            ProcessType = processType,
            Notes = dto.Notes,
            SelectedEmployeeIds = dto.EmployeeIds.Count > 0
                ? System.Text.Json.JsonSerializer.Serialize(dto.EmployeeIds)
                : null,
            EmployeeCount = dto.EmployeeIds.Count,
        };
        _db.PayrollBatches.Add(entity);
        await _db.SaveChangesAsync();
        return MapBatchDto(entity);
    }

    public async Task<PayrollBatchDto?> ReviewBatchAsync(Guid id, string reviewedBy)
    {
        var batch = await _db.PayrollBatches.FindAsync(id);
        if (batch is null) return null;
        if (batch.Status != BatchStatus.Calculated)
            throw new InvalidOperationException($"Batch must be Calculated before review. Current: {batch.Status}");

        batch.Status = BatchStatus.Reviewed;
        batch.ReviewedBy = string.IsNullOrWhiteSpace(reviewedBy) ? "System" : reviewedBy.Trim();
        batch.ReviewedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return MapBatchDto(batch);
    }

    public async Task<PayrollBatchDto?> ApproveBatchAsync(Guid id, string approvedBy)
    {
        var batch = await _db.PayrollBatches
            .Include(b => b.PayStatements)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (batch is null) return null;
        if (batch.Status != BatchStatus.Calculated && batch.Status != BatchStatus.Reviewed)
            throw new InvalidOperationException($"Batch must be Calculated or Reviewed before HR salary approval. Current: {batch.Status}");

        var actor = string.IsNullOrWhiteSpace(approvedBy) ? "System" : approvedBy.Trim();
        var now = DateTime.UtcNow;
        if (batch.Status == BatchStatus.Calculated)
        {
            batch.ReviewedBy ??= actor;
            batch.ReviewedAt ??= now;
        }

        batch.ApprovedBy = actor;
        batch.ApprovedAt = now;
        batch.Status = BatchStatus.Finalized;
        foreach (var stmt in batch.PayStatements)
            stmt.Status = PayStatementStatus.Finalized;
        await _db.SaveChangesAsync();
        await RebuildApitBalancesForBatchAsync(batch);
        return MapBatchDto(batch);
    }

    public async Task<PayrollBatchDto?> ReturnBatchToCalculatedAsync(Guid id)
    {
        var batch = await _db.PayrollBatches.FindAsync(id);
        if (batch is null) return null;
        if (batch.Status != BatchStatus.Reviewed)
            throw new InvalidOperationException($"Only Reviewed batches can be sent back. Current: {batch.Status}");

        batch.Status = BatchStatus.Calculated;
        batch.ReviewedBy = null;
        batch.ReviewedAt = null;
        await _db.SaveChangesAsync();
        return MapBatchDto(batch);
    }

    public async Task<PayrollBatchDto?> FinalizeBatchAsync(Guid id)
    {
        var batch = await _db.PayrollBatches
            .Include(b => b.PayStatements)
            .FirstOrDefaultAsync(b => b.Id == id);
        if (batch is null) return null;
        if (batch.Status != BatchStatus.Approved)
            throw new InvalidOperationException($"Batch must be Approved before finalizing. Current: {batch.Status}");

        batch.Status = BatchStatus.Finalized;
        foreach (var stmt in batch.PayStatements)
            stmt.Status = PayStatementStatus.Finalized;
        await _db.SaveChangesAsync();
        await RebuildApitBalancesForBatchAsync(batch);
        return MapBatchDto(batch);
    }

    public async Task<bool> DeleteBatchAsync(Guid id)
    {
        var entity = await _db.PayrollBatches.FindAsync(id);
        if (entity is null || (entity.Status != BatchStatus.Draft && entity.Status != BatchStatus.Calculated)) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Pay Statements ───────────────────────────────────────────────

    public async Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, string? search = null, IReadOnlyList<Guid>? allowedEmployeeIds = null, Guid? batchId = null)
    {
        var query = _db.PayStatements
            .Include(p => p.Employee).ThenInclude(e => e.Department)
            .AsQueryable();
        if (batchId.HasValue) query = query.Where(p => p.BatchId == batchId.Value);
        if (employeeId.HasValue) query = query.Where(p => p.EmployeeId == employeeId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.Employee.FirstName.ToLower().Contains(term) ||
                p.Employee.LastName.ToLower().Contains(term) ||
                p.Employee.EmployeeCode.ToLower().Contains(term) ||
                (p.Employee.FirstName + " " + p.Employee.LastName).ToLower().Contains(term));
        }
        if (allowedEmployeeIds != null) query = query.Where(p => allowedEmployeeIds.Contains(p.EmployeeId));

        query = await RestrictToCanonicalStatementsAsync(query);

        var total = await query.CountAsync();

        // Sort by employee code (ascending, numeric-aware) then newest period first.
        // Paginate in SQL to avoid loading all rows into memory.
        var items = await query
            .OrderBy(p => p.Employee.EmployeeCode)
            .ThenByDescending(p => p.Year)
            .ThenByDescending(p => p.Month)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PayStatementDto
            {
                Id = p.Id, BatchId = p.BatchId, EmployeeId = p.EmployeeId,
                EmployeeName = p.Employee.FirstName + " " + p.Employee.LastName,
                EmployeeCode = p.Employee.EmployeeCode,
                Department = p.Employee.Department != null ? p.Employee.Department.Name : null,
                Month = p.Month, Year = p.Year, BasicPay = p.BasicPay,
                TotalEarnings = p.TotalEarnings, TotalDeductions = p.TotalDeductions,
                GrossPay = p.GrossPay, NetPay = p.NetPay, EmployerCost = p.EmployerCost,
                Status = p.Status.ToString(),
            })
            .ToListAsync();

        // Apply numeric-aware re-sort on the page slice for codes like EMP-001, EMP-002
        items = items
            .OrderBy(p => EmployeeCodeSort.NumericKey(p.EmployeeCode))
            .ThenBy(p => p.EmployeeCode, StringComparer.OrdinalIgnoreCase)
            .ThenByDescending(p => p.Year)
            .ThenByDescending(p => p.Month)
            .ToList();

        return new PagedResult<PayStatementDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PayStatementDto?> GetStatementByIdAsync(Guid id)
    {
        var p = await _db.PayStatements
            .Include(s => s.Employee).ThenInclude(e => e.Department)
            .Include(s => s.Lines)
            .FirstOrDefaultAsync(s => s.Id == id);
        return p is null ? null : MapPayStatementDto(p, includeLines: true);
    }

    public async Task<List<PayStatementDto>> GetStatementsByBatchAsync(Guid batchId)
    {
        var statements = await _db.PayStatements
            .Include(p => p.Employee).ThenInclude(e => e.Department)
            .Include(p => p.Lines)
            .Where(p => p.BatchId == batchId)
            .ToListAsync();

        return statements
            .OrderBy(p => EmployeeCodeSort.NumericKey(p.Employee.EmployeeCode))
            .ThenBy(p => p.Employee.EmployeeCode, StringComparer.OrdinalIgnoreCase)
            .Select(p => MapPayStatementDto(p, includeLines: true))
            .ToList();
    }

    public async Task<List<PayStatementDto>> GetStatementsByEmployeeAsync(Guid employeeId)
    {
        var query = _db.PayStatements
            .Include(p => p.Employee).ThenInclude(e => e.Department)
            .Where(p => p.EmployeeId == employeeId);
        query = await RestrictToCanonicalStatementsAsync(query);

        return await query
            .OrderByDescending(p => p.Year).ThenByDescending(p => p.Month)
            .Select(p => new PayStatementDto
            {
                Id = p.Id, BatchId = p.BatchId, EmployeeId = p.EmployeeId,
                EmployeeName = p.Employee.FirstName + " " + p.Employee.LastName,
                EmployeeCode = p.Employee.EmployeeCode,
                Department = p.Employee.Department != null ? p.Employee.Department.Name : null,
                Month = p.Month, Year = p.Year, BasicPay = p.BasicPay,
                TotalEarnings = p.TotalEarnings, TotalDeductions = p.TotalDeductions,
                GrossPay = p.GrossPay, NetPay = p.NetPay, EmployerCost = p.EmployerCost,
                Status = p.Status.ToString(),
            }).ToListAsync();
    }

    // ── Payroll Settings ─────────────────────────────────────────────

    public async Task<PayrollSettingsDto> GetPayrollSettingsAsync()
    {
        try
        {
            await PayrollComponentSeeder.EnsureDefaultSettingsAsync(_db);
        }
        catch
        {
            // Fall back to hard-coded defaults below if settings table is unavailable.
        }

        return new PayrollSettingsDto
        {
            EpfEmployeeRate = PayrollCalculationEngine.NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployeeRate"), out var ee) ? ee : 0.08m),
            EpfEmployerRate = PayrollCalculationEngine.NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployerRate"), out var er) ? er : 0.12m),
            EtfEmployerRate = PayrollCalculationEngine.NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_ETF_EmployerRate"), out var etf) ? etf : 0.03m),
            OtHourlyDivisor = decimal.TryParse(await _settings.GetAsync("Payroll_OT_HourlyDivisor"), out var div) ? div : 208m,
            OtMultiplier = decimal.TryParse(await _settings.GetAsync("Payroll_OT_Multiplier"), out var mul) ? mul : 1.5m,
            ApitTaxMode = PayrollCalculationEngine.NormalizeApitTaxMode(
                await _settings.GetAsync("Payroll_APIT_TaxMode")),
        };
    }

    public async Task<PayrollSettingsDto> UpdatePayrollSettingsAsync(PayrollSettingsDto dto)
    {
        await _settings.SetAsync("Payroll_EPF_EmployeeRate", dto.EpfEmployeeRate.ToString());
        await _settings.SetAsync("Payroll_EPF_EmployerRate", dto.EpfEmployerRate.ToString());
        await _settings.SetAsync("Payroll_ETF_EmployerRate", dto.EtfEmployerRate.ToString());
        await _settings.SetAsync("Payroll_OT_HourlyDivisor", dto.OtHourlyDivisor.ToString());
        await _settings.SetAsync("Payroll_OT_Multiplier", dto.OtMultiplier.ToString());
        if (!string.IsNullOrWhiteSpace(dto.ApitTaxMode))
            await _settings.SetAsync("Payroll_APIT_TaxMode", PayrollCalculationEngine.NormalizeApitTaxMode(dto.ApitTaxMode));
        dto.ApitTaxMode = PayrollCalculationEngine.NormalizeApitTaxMode(
            string.IsNullOrWhiteSpace(dto.ApitTaxMode)
                ? await _settings.GetAsync("Payroll_APIT_TaxMode")
                : dto.ApitTaxMode);
        return dto;
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private async Task<IQueryable<PayStatement>> RestrictToCanonicalStatementsAsync(IQueryable<PayStatement> query)
    {
        var keys = await query
            .Select(p => new PayrollPeriodOccupancy.PayStatementKey(
                p.Id, p.EmployeeId, p.Month, p.Year, p.Batch.ProcessType, p.Status, p.CreatedAt))
            .ToListAsync();
        var keepIds = PayrollPeriodOccupancy.CanonicalStatementIds(keys);
        return query.Where(p => keepIds.Contains(p.Id));
    }

    private static CompensationComponentDto MapComponentDto(CompensationComponent c) => new()
    {
        Id = c.Id, Name = c.Name, Code = c.Code,
        Type = c.Type.ToString(), Category = c.Category.ToString(),
        IsTaxable = c.IsTaxable, IsEpfApplicable = c.IsEpfApplicable, IsEtfApplicable = c.IsEtfApplicable,
        IsStatutory = c.IsStatutory, IsActive = c.IsActive,
        Description = c.Description, FormulaExpression = c.FormulaExpression,
        DependsOnComponentCode = c.DependsOnComponentCode,
        SortOrder = c.SortOrder, IsEmployerContribution = c.IsEmployerContribution,
    };

    private static (DateTime EffectiveFrom, DateTime? EffectiveTo) ResolveBatchEffectiveDates(CreatePayrollBatchDto dto)
    {
        var effectiveFrom = dto.EffectiveFrom?.Date
            ?? new DateTime(dto.Year, dto.Month, 1);
        var effectiveTo = dto.EffectiveTo?.Date
            ?? new DateTime(dto.Year, dto.Month, DateTime.DaysInMonth(dto.Year, dto.Month));

        if (effectiveTo < effectiveFrom)
            throw new InvalidOperationException("Effective end date must be on or after the start date.");

        return (effectiveFrom, effectiveTo);
    }

    private async Task RebuildApitBalancesForBatchAsync(PayrollBatch batch)
    {
        if (batch.ProcessType is not (PayrollProcessType.Salary or PayrollProcessType.Bonus))
            return;

        var employeeIds = batch.PayStatements
            .Select(s => s.EmployeeId)
            .Distinct()
            .ToList();
        if (employeeIds.Count == 0)
            return;

        await new PayrollCalculationEngine(_db, _settings).RebuildEmployeeApitYearBalancesAsync(
            employeeIds, PayrollCalculationEngine.ApitTaxYearStartYear(batch.Month, batch.Year));
    }

    private static PayStatementDto MapPayStatementDto(PayStatement p, bool includeLines)
    {
        return new PayStatementDto
        {
            Id = p.Id, BatchId = p.BatchId, EmployeeId = p.EmployeeId,
            EmployeeName = p.Employee.FirstName + " " + p.Employee.LastName,
            EmployeeCode = p.Employee.EmployeeCode,
            Department = p.Employee.Department?.Name,
            Month = p.Month, Year = p.Year, BasicPay = p.BasicPay,
            TotalEarnings = p.TotalEarnings, TotalDeductions = p.TotalDeductions,
            GrossPay = p.GrossPay, NetPay = p.NetPay, EmployerCost = p.EmployerCost,
            Status = p.Status.ToString(),
            Lines = includeLines
                ? (p.Lines ?? []).OrderBy(l => l.SortOrder).Select(l => new PayStatementLineDto
                {
                    Id = l.Id, ComponentId = l.ComponentId,
                    ComponentName = l.ComponentName, ComponentCode = l.ComponentCode,
                    Type = l.Type, Amount = l.Amount,
                    IsEmployerContribution = l.IsEmployerContribution, SortOrder = l.SortOrder,
                }).ToList()
                : new List<PayStatementLineDto>(),
        };
    }

    private static ComponentType ParseComponentType(string type)
    {
        if (string.Equals(type, "Days", StringComparison.OrdinalIgnoreCase))
            return ComponentType.Day;
        if (string.Equals(type, "Income", StringComparison.OrdinalIgnoreCase))
            return ComponentType.Earning;
        return Enum.Parse<ComponentType>(type, ignoreCase: true);
    }

    private static PayrollBatchDto MapBatchDto(PayrollBatch b)
    {
        var selectedCount = 0;
        if (!string.IsNullOrEmpty(b.SelectedEmployeeIds))
        {
            try { selectedCount = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(b.SelectedEmployeeIds)?.Count ?? 0; } catch { }
        }
        return new()
        {
            Id = b.Id, BatchCode = b.BatchCode, Month = b.Month, Year = b.Year,
            EffectiveFrom = b.EffectiveFrom, EffectiveTo = b.EffectiveTo,
            ProcessType = b.ProcessType.ToString(), Status = b.Status.ToString(), ProcessedAt = b.ProcessedAt,
            ReviewedBy = b.ReviewedBy, ReviewedAt = b.ReviewedAt,
            ApprovedBy = b.ApprovedBy, ApprovedAt = b.ApprovedAt,
            EmployeeCount = b.EmployeeCount, TotalGross = b.TotalGross,
            TotalDeductions = b.TotalDeductions, TotalNet = b.TotalNet,
            TotalEmployerCost = b.TotalEmployerCost, Notes = b.Notes,
            SelectedCount = selectedCount,
            CreatedAt = b.CreatedAt,
        };
    }
}
