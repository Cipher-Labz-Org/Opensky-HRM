using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class PayrollService : IPayrollService
{
    private readonly AppDbContext _db;
    public PayrollService(AppDbContext db) { _db = db; }

    public async Task<List<CompensationComponentDto>> GetComponentsAsync()
    {
        return await _db.CompensationComponents.OrderBy(c => c.Name)
            .Select(c => new CompensationComponentDto
            {
                Id = c.Id, Name = c.Name, Code = c.Code, Type = c.Type,
                IsTaxable = c.IsTaxable, IsStatutory = c.IsStatutory, IsActive = c.IsActive,
            }).ToListAsync();
    }

    public async Task<List<EmployeeCompensationDto>> GetEmployeeCompensationAsync(Guid employeeId)
    {
        return await _db.EmployeeCompensations
            .Include(ec => ec.Employee).Include(ec => ec.Component)
            .Where(ec => ec.EmployeeId == employeeId)
            .Select(ec => new EmployeeCompensationDto
            {
                Id = ec.Id, EmployeeName = ec.Employee.FirstName + " " + ec.Employee.LastName,
                ComponentName = ec.Component.Name, Amount = ec.Amount,
                Currency = ec.Currency, EffectiveFrom = ec.EffectiveFrom,
            }).ToListAsync();
    }

    public async Task<PagedResult<SalaryRevisionDto>> GetRevisionsAsync(int page = 1, int pageSize = 20)
    {
        var query = _db.SalaryRevisions.Include(s => s.Employee).AsQueryable();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(s => s.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(s => new SalaryRevisionDto
            {
                Id = s.Id, EmployeeName = s.Employee.FirstName + " " + s.Employee.LastName,
                RevisionType = s.RevisionType, CurrentSalary = s.CurrentSalary, ProposedSalary = s.ProposedSalary,
                ChangePercentage = s.ChangePercentage, Status = s.Status.ToString(), EffectiveDate = s.EffectiveDate,
            }).ToListAsync();
        return new PagedResult<SalaryRevisionDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PagedResult<PayrollBatchDto>> GetBatchesAsync(int page = 1, int pageSize = 20)
    {
        var query = _db.PayrollBatches.AsQueryable();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(b => b.Year).ThenByDescending(b => b.Month).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(b => new PayrollBatchDto
            {
                Id = b.Id, BatchCode = b.BatchCode, Month = b.Month, Year = b.Year,
                Status = b.Status, EmployeeCount = b.EmployeeCount, TotalGross = b.TotalGross, TotalNet = b.TotalNet,
            }).ToListAsync();
        return new PagedResult<PayrollBatchDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = _db.PayStatements.Include(p => p.Employee).AsQueryable();
        if (employeeId.HasValue) query = query.Where(p => p.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null) query = query.Where(p => allowedEmployeeIds.Contains(p.EmployeeId));

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new PayStatementDto
            {
                Id = p.Id, EmployeeName = p.Employee.FirstName + " " + p.Employee.LastName,
                Month = p.Month, Year = p.Year, GrossPay = p.GrossPay,
                Deductions = p.Deductions, NetPay = p.NetPay, Status = p.Status,
            }).ToListAsync();
        return new PagedResult<PayStatementDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }
}
