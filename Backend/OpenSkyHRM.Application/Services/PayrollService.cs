using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

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
            Type = Enum.Parse<ComponentType>(dto.Type),
            Category = Enum.Parse<ComponentCategory>(dto.Category),
            IsTaxable = dto.IsTaxable,
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
        entity.Type = Enum.Parse<ComponentType>(dto.Type);
        entity.Category = Enum.Parse<ComponentCategory>(dto.Category);
        entity.IsTaxable = dto.IsTaxable;
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
                Amount = ec.Amount, Currency = ec.Currency,
                EffectiveFrom = ec.EffectiveFrom, EffectiveTo = ec.EffectiveTo,
                IsActive = ec.IsActive, BatchId = ec.BatchId,
            }).ToListAsync();
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
        var query = _db.PayrollBatches.AsQueryable();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.Year).ThenByDescending(b => b.Month)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(b => MapBatchDto(b)).ToListAsync();
        return new PagedResult<PayrollBatchDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PayrollBatchDto?> GetBatchByIdAsync(Guid id)
    {
        var b = await _db.PayrollBatches.FindAsync(id);
        return b is null ? null : MapBatchDto(b);
    }

    public async Task<PayrollBatchDto> CreateBatchAsync(CreatePayrollBatchDto dto)
    {
        var count = await _db.PayrollBatches.CountAsync(b => b.Year == dto.Year && b.Month == dto.Month) + 1;
        var entity = new PayrollBatch
        {
            BatchCode = $"PR-{dto.Year}-{dto.Month:D2}-{count:D3}",
            Month = dto.Month,
            Year = dto.Year,
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

    public async Task<PayrollBatchDto?> UpdateBatchAsync(Guid id, UpdatePayrollBatchDto dto)
    {
        var entity = await _db.PayrollBatches.FindAsync(id);
        if (entity is null) return null;

        if (entity.Status != BatchStatus.Draft && entity.Status != BatchStatus.Calculated && entity.Status != BatchStatus.Reviewed)
            throw new InvalidOperationException($"Only Draft, Calculated, or Reviewed batches can be edited. Current: {entity.Status}");

        if (dto.EmployeeIds.Count == 0)
            throw new InvalidOperationException("Select at least one employee.");

        entity.SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(dto.EmployeeIds);
        entity.EmployeeCount = dto.EmployeeIds.Count;
        entity.Notes = dto.Notes;

        await _db.SaveChangesAsync();
        return MapBatchDto(entity);
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

    public async Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = _db.PayStatements
            .Include(p => p.Employee).ThenInclude(e => e.Department)
            .AsQueryable();
        if (employeeId.HasValue) query = query.Where(p => p.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null) query = query.Where(p => allowedEmployeeIds.Contains(p.EmployeeId));

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month)
            .Skip((page - 1) * pageSize).Take(pageSize)
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
        return new PagedResult<PayStatementDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PayStatementDto?> GetStatementByIdAsync(Guid id)
    {
        var p = await _db.PayStatements
            .Include(s => s.Employee).ThenInclude(e => e.Department)
            .Include(s => s.Lines)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (p is null) return null;

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
            Lines = p.Lines.OrderBy(l => l.SortOrder).Select(l => new PayStatementLineDto
            {
                Id = l.Id, ComponentId = l.ComponentId,
                ComponentName = l.ComponentName, ComponentCode = l.ComponentCode,
                Type = l.Type, Amount = l.Amount,
                IsEmployerContribution = l.IsEmployerContribution, SortOrder = l.SortOrder,
            }).ToList(),
        };
    }

    public async Task<List<PayStatementDto>> GetStatementsByEmployeeAsync(Guid employeeId)
    {
        return await _db.PayStatements
            .Include(p => p.Employee).ThenInclude(e => e.Department)
            .Where(p => p.EmployeeId == employeeId)
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
        return new PayrollSettingsDto
        {
            EpfEmployeeRate = decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployeeRate"), out var ee) ? ee : 0.08m,
            EpfEmployerRate = decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployerRate"), out var er) ? er : 0.12m,
            EtfEmployerRate = decimal.TryParse(await _settings.GetAsync("Payroll_ETF_EmployerRate"), out var etf) ? etf : 0.03m,
        };
    }

    public async Task<PayrollSettingsDto> UpdatePayrollSettingsAsync(PayrollSettingsDto dto)
    {
        await _settings.SetAsync("Payroll_EPF_EmployeeRate", dto.EpfEmployeeRate.ToString());
        await _settings.SetAsync("Payroll_EPF_EmployerRate", dto.EpfEmployerRate.ToString());
        await _settings.SetAsync("Payroll_ETF_EmployerRate", dto.EtfEmployerRate.ToString());
        return dto;
    }

    // ── Salary advance requests ─────────────────────────────────────

    public async Task<List<PayrollAdvanceBatchOptionDto>> GetActivePayrunBatchOptionsForAdvanceAsync()
    {
        var openStatuses = new[]
        {
            BatchStatus.Draft,
            BatchStatus.Calculated,
            BatchStatus.Reviewed,
            BatchStatus.Approved,
        };
        return await _db.PayrollBatches
            .AsNoTracking()
            .Where(b => openStatuses.Contains(b.Status))
            .OrderByDescending(b => b.Year).ThenByDescending(b => b.Month).ThenByDescending(b => b.CreatedAt)
            .Select(b => new PayrollAdvanceBatchOptionDto
            {
                Id = b.Id,
                BatchCode = b.BatchCode,
                Month = b.Month,
                Year = b.Year,
                Status = b.Status.ToString(),
            })
            .ToListAsync();
    }

    public async Task<List<SalaryAdvanceRequestDto>> GetSalaryAdvanceRequestsForEmployeeAsync(Guid employeeId)
    {
        return await _db.SalaryAdvanceRequests
            .AsNoTracking()
            .Where(r => r.EmployeeId == employeeId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new SalaryAdvanceRequestDto
            {
                Id = r.Id,
                EmployeeId = r.EmployeeId,
                EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
                EmployeeCode = r.Employee.EmployeeCode,
                PayrollBatchId = r.PayrollBatchId,
                BatchCode = r.PayrollBatch.BatchCode,
                BatchMonth = r.PayrollBatch.Month,
                BatchYear = r.PayrollBatch.Year,
                Amount = r.Amount,
                Currency = r.Currency,
                Status = r.Status.ToString(),
                Remarks = r.Remarks,
                ReviewedBy = r.ReviewedBy,
                ReviewedAt = r.ReviewedAt,
                RejectionReason = r.RejectionReason,
                CreatedAt = r.CreatedAt,
            })
            .ToListAsync();
    }

    public async Task<List<SalaryAdvanceRequestDto>> GetSalaryAdvanceRequestsForHrAsync(string? status, IReadOnlyList<Guid>? allowedEmployeeIds)
    {
        var q = _db.SalaryAdvanceRequests
            .AsNoTracking()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<SalaryAdvanceRequestStatus>(status, true, out var st))
        {
            q = q.Where(r => r.Status == st);
        }

        if (allowedEmployeeIds != null)
            q = q.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));

        var list = await q
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new SalaryAdvanceRequestDto
            {
                Id = r.Id,
                EmployeeId = r.EmployeeId,
                EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
                EmployeeCode = r.Employee.EmployeeCode,
                PayrollBatchId = r.PayrollBatchId,
                BatchCode = r.PayrollBatch.BatchCode,
                BatchMonth = r.PayrollBatch.Month,
                BatchYear = r.PayrollBatch.Year,
                Amount = r.Amount,
                Currency = r.Currency,
                Status = r.Status.ToString(),
                Remarks = r.Remarks,
                ReviewedBy = r.ReviewedBy,
                ReviewedAt = r.ReviewedAt,
                RejectionReason = r.RejectionReason,
                CreatedAt = r.CreatedAt,
            })
            .ToListAsync();

        return list
            .OrderBy(r => string.Equals(r.Status, nameof(SalaryAdvanceRequestStatus.Pending), StringComparison.OrdinalIgnoreCase) ? 0 : 1)
            .ThenByDescending(r => r.CreatedAt)
            .ToList();
    }

    public async Task<SalaryAdvanceRequestDto> CreateSalaryAdvanceRequestAsync(Guid employeeId, CreateSalaryAdvanceRequestDto dto)
    {
        if (dto.Amount <= 0)
            throw new InvalidOperationException("Amount must be greater than zero.");

        var batch = await _db.PayrollBatches.FirstOrDefaultAsync(b => b.Id == dto.PayrollBatchId);
        if (batch is null)
            throw new InvalidOperationException("Payroll run not found.");

        var openStatuses = new[]
        {
            BatchStatus.Draft,
            BatchStatus.Calculated,
            BatchStatus.Reviewed,
            BatchStatus.Approved,
        };
        if (!openStatuses.Contains(batch.Status))
            throw new InvalidOperationException(
                "Salary advances can only be requested against an open pay run (Draft, Calculated, Reviewed, or Approved — not yet finalized).");

        var existingPending = await _db.SalaryAdvanceRequests
            .AnyAsync(r => r.EmployeeId == employeeId
                && r.PayrollBatchId == dto.PayrollBatchId
                && r.Status == SalaryAdvanceRequestStatus.Pending);
        if (existingPending)
            throw new InvalidOperationException("This employee already has a pending advance request for this pay run.");

        var entity = new SalaryAdvanceRequest
        {
            EmployeeId = employeeId,
            PayrollBatchId = dto.PayrollBatchId,
            Amount = dto.Amount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "LKR" : dto.Currency,
            Status = SalaryAdvanceRequestStatus.Pending,
            Remarks = dto.Remarks,
        };
        _db.SalaryAdvanceRequests.Add(entity);
        await _db.SaveChangesAsync();

        await _db.Entry(entity).Reference(e => e.Employee).LoadAsync();
        await _db.Entry(entity).Reference(e => e.PayrollBatch).LoadAsync();
        return MapSalaryAdvanceDto(entity);
    }

    public async Task<SalaryAdvanceRequestDto?> ApproveSalaryAdvanceRequestAsync(Guid id, string reviewedBy)
    {
        var entity = await _db.SalaryAdvanceRequests
            .Include(r => r.Employee)
            .Include(r => r.PayrollBatch)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null) return null;
        if (entity.Status != SalaryAdvanceRequestStatus.Pending)
            throw new InvalidOperationException("Only pending requests can be approved.");

        entity.Status = SalaryAdvanceRequestStatus.Approved;
        entity.ReviewedBy = reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.RejectionReason = null;
        await _db.SaveChangesAsync();

        await SyncSalaryAdvanceDeductionLineForBatchAsync(entity.EmployeeId, entity.PayrollBatchId);

        return MapSalaryAdvanceDto(entity);
    }

    public async Task ReconcileSalaryAdvanceDeductionLinesForBatchAsync(Guid payrollBatchId)
    {
        var employeeIds = await _db.SalaryAdvanceRequests
            .AsNoTracking()
            .Where(r => r.PayrollBatchId == payrollBatchId)
            .Select(r => r.EmployeeId)
            .Distinct()
            .ToListAsync();

        foreach (var employeeId in employeeIds)
            await SyncSalaryAdvanceDeductionLineForBatchAsync(employeeId, payrollBatchId);
    }

    public async Task<SalaryAdvanceRequestDto?> RejectSalaryAdvanceRequestAsync(Guid id, string reviewedBy, string? reason)
    {
        var entity = await _db.SalaryAdvanceRequests
            .Include(r => r.Employee)
            .Include(r => r.PayrollBatch)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (entity is null) return null;
        if (entity.Status != SalaryAdvanceRequestStatus.Pending)
            throw new InvalidOperationException("Only pending requests can be rejected.");

        entity.Status = SalaryAdvanceRequestStatus.Rejected;
        entity.ReviewedBy = reviewedBy;
        entity.ReviewedAt = DateTime.UtcNow;
        entity.RejectionReason = reason;
        await _db.SaveChangesAsync();
        return MapSalaryAdvanceDto(entity);
    }

    /// <summary>
    /// Keeps the variable "ADVANCE" deduction line in sync with the sum of approved salary advance
    /// requests for the same employee and pay run (used by payroll calculation and Employee Salary UI).
    /// </summary>
    private async Task SyncSalaryAdvanceDeductionLineForBatchAsync(Guid employeeId, Guid payrollBatchId)
    {
        const string advanceCode = "ADVANCE";
        var advanceComponent = await _db.CompensationComponents
            .FirstOrDefaultAsync(c => c.Code == advanceCode);
        if (advanceComponent is null)
        {
            throw new InvalidOperationException(
                $"Salary advance recovery requires a compensation component with code {advanceCode}. " +
                "Add it under Payroll → Components (or run payroll seed).");
        }

        var approved = await _db.SalaryAdvanceRequests
            .Where(r => r.EmployeeId == employeeId
                && r.PayrollBatchId == payrollBatchId
                && r.Status == SalaryAdvanceRequestStatus.Approved)
            .ToListAsync();

        var total = approved.Sum(r => r.Amount);
        var currency = approved.Count > 0
            ? (string.IsNullOrWhiteSpace(approved[0].Currency) ? "LKR" : approved[0].Currency.Trim())
            : "LKR";

        var candidates = await _db.EmployeeCompensations
            .Where(ec => ec.EmployeeId == employeeId && ec.ComponentId == advanceComponent.Id)
            .ToListAsync();

        var forThisBatch = candidates.Where(ec => ec.BatchId == payrollBatchId).ToList();

        if (total <= 0)
        {
            foreach (var ec in forThisBatch)
            {
                ec.Amount = 0;
                ec.IsActive = false;
            }

            await _db.SaveChangesAsync();
            return;
        }

        var existing = forThisBatch.FirstOrDefault()
            ?? candidates.FirstOrDefault(ec => ec.BatchId is null);

        if (existing is not null)
        {
            existing.Amount = total;
            existing.Currency = currency;
            existing.IsActive = true;
            existing.BatchId = payrollBatchId;
            existing.EffectiveTo = null;
        }
        else
        {
            _db.EmployeeCompensations.Add(new EmployeeCompensation
            {
                EmployeeId = employeeId,
                ComponentId = advanceComponent.Id,
                Amount = total,
                Currency = currency,
                EffectiveFrom = DateTime.UtcNow.Date,
                EffectiveTo = null,
                IsActive = true,
                BatchId = payrollBatchId,
            });
        }

        await _db.SaveChangesAsync();
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private static SalaryAdvanceRequestDto MapSalaryAdvanceDto(SalaryAdvanceRequest r) => new()
    {
        Id = r.Id,
        EmployeeId = r.EmployeeId,
        EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
        EmployeeCode = r.Employee.EmployeeCode,
        PayrollBatchId = r.PayrollBatchId,
        BatchCode = r.PayrollBatch.BatchCode,
        BatchMonth = r.PayrollBatch.Month,
        BatchYear = r.PayrollBatch.Year,
        Amount = r.Amount,
        Currency = r.Currency,
        Status = r.Status.ToString(),
        Remarks = r.Remarks,
        ReviewedBy = r.ReviewedBy,
        ReviewedAt = r.ReviewedAt,
        RejectionReason = r.RejectionReason,
        CreatedAt = r.CreatedAt,
    };

    private static CompensationComponentDto MapComponentDto(CompensationComponent c) => new()
    {
        Id = c.Id, Name = c.Name, Code = c.Code,
        Type = c.Type.ToString(), Category = c.Category.ToString(),
        IsTaxable = c.IsTaxable, IsStatutory = c.IsStatutory, IsActive = c.IsActive,
        Description = c.Description, FormulaExpression = c.FormulaExpression,
        DependsOnComponentCode = c.DependsOnComponentCode,
        SortOrder = c.SortOrder, IsEmployerContribution = c.IsEmployerContribution,
    };

    private static PayrollBatchDto MapBatchDto(PayrollBatch b)
    {
        var selectedIds = new List<Guid>();
        var selectedCount = 0;
        if (!string.IsNullOrEmpty(b.SelectedEmployeeIds))
        {
            try
            {
                selectedIds = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(b.SelectedEmployeeIds) ?? new List<Guid>();
                selectedCount = selectedIds.Count;
            }
            catch
            {
                selectedIds = new List<Guid>();
                selectedCount = 0;
            }
        }
        return new()
        {
            Id = b.Id, BatchCode = b.BatchCode, Month = b.Month, Year = b.Year,
            Status = b.Status.ToString(), ProcessedAt = b.ProcessedAt, ApprovedBy = b.ApprovedBy,
            EmployeeCount = b.EmployeeCount, TotalGross = b.TotalGross,
            TotalDeductions = b.TotalDeductions, TotalNet = b.TotalNet,
            TotalEmployerCost = b.TotalEmployerCost, Notes = b.Notes,
            SelectedCount = selectedCount,
            SelectedEmployeeIds = selectedIds,
            CreatedAt = b.CreatedAt,
        };
    }
}
