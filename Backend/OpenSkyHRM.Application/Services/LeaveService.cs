using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class LeaveService : ILeaveService
{
    private readonly AppDbContext _db;

    public LeaveService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<LeaveRequestDto>> GetLeaveRequestsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? employeeId = null)
    {
        var query = _db.Set<LeaveRequest>()
            .Include(r => r.Employee)
            .Include(r => r.LeaveType)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ApprovalStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        if (employeeId.HasValue)
            query = query.Where(r => r.EmployeeId == employeeId.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new LeaveRequestDto
            {
                Id = r.Id,
                EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
                EmployeeCode = r.Employee.EmployeeCode,
                EmployeeId = r.EmployeeId,
                LeaveTypeName = r.LeaveType.Name,
                StartDate = r.StartDate,
                EndDate = r.EndDate,
                TotalDays = r.TotalDays,
                Reason = r.Reason,
                Status = r.Status.ToString(),
                CoveragePerson = r.CoveragePerson,
                ApproverRemarks = r.ApproverRemarks,
                CreatedAt = r.CreatedAt,
            })
            .ToListAsync();

        return new PagedResult<LeaveRequestDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto)
    {
        var request = new LeaveRequest
        {
            EmployeeId = dto.EmployeeId,
            LeaveTypeId = dto.LeaveTypeId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            TotalDays = dto.TotalDays,
            Reason = dto.Reason,
            CoveragePerson = dto.CoveragePerson,
            Status = ApprovalStatus.Pending,
        };

        _db.Set<LeaveRequest>().Add(request);
        await _db.SaveChangesAsync();

        var created = await _db.Set<LeaveRequest>()
            .Include(r => r.Employee).Include(r => r.LeaveType)
            .FirstAsync(r => r.Id == request.Id);

        return new LeaveRequestDto
        {
            Id = created.Id,
            EmployeeName = created.Employee.FirstName + " " + created.Employee.LastName,
            EmployeeCode = created.Employee.EmployeeCode,
            EmployeeId = created.EmployeeId,
            LeaveTypeName = created.LeaveType.Name,
            StartDate = created.StartDate,
            EndDate = created.EndDate,
            TotalDays = created.TotalDays,
            Reason = created.Reason,
            Status = created.Status.ToString(),
            CoveragePerson = created.CoveragePerson,
            CreatedAt = created.CreatedAt,
        };
    }

    public async Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null || request.Status != ApprovalStatus.Pending) return null;

        request.Status = ApprovalStatus.Approved;
        request.ApproverId = approverId;
        request.ApproverRemarks = dto.Remarks;
        request.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return (await GetLeaveRequestsAsync(1, 1)).Items.FirstOrDefault();
    }

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null || request.Status != ApprovalStatus.Pending) return null;

        request.Status = ApprovalStatus.Rejected;
        request.ApproverId = approverId;
        request.ApproverRemarks = dto.Remarks;
        await _db.SaveChangesAsync();

        return (await GetLeaveRequestsAsync(1, 1)).Items.FirstOrDefault();
    }

    public async Task<List<LeaveTypeDto>> GetLeaveTypesAsync()
    {
        return await _db.Set<LeaveType>()
            .OrderBy(t => t.Name)
            .Select(t => new LeaveTypeDto
            {
                Id = t.Id, Name = t.Name, Code = t.Code,
                DefaultDaysPerYear = t.DefaultDaysPerYear, IsPaid = t.IsPaid, IsActive = t.IsActive
            })
            .ToListAsync();
    }

    public async Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year)
    {
        return await _db.Set<LeaveBalance>()
            .Include(b => b.LeaveType)
            .Where(b => b.EmployeeId == employeeId && b.Year == year)
            .Select(b => new LeaveBalanceDto
            {
                Id = b.Id, LeaveTypeName = b.LeaveType.Name, Year = b.Year,
                Entitled = b.Entitled, Used = b.Used, CarriedForward = b.CarriedForward,
                Remaining = b.Entitled + b.CarriedForward - b.Used
            })
            .ToListAsync();
    }

    public async Task<List<HolidayDto>> GetHolidaysAsync(int year)
    {
        return await _db.Set<Holiday>()
            .Where(h => h.Year == year)
            .OrderBy(h => h.Date)
            .Select(h => new HolidayDto { Id = h.Id, Name = h.Name, Date = h.Date, IsRestricted = h.IsRestricted, Year = h.Year })
            .ToListAsync();
    }

    public async Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto)
    {
        var holiday = new Holiday { Name = dto.Name, Date = dto.Date, IsRestricted = dto.IsRestricted, Description = dto.Description, Year = dto.Year };
        _db.Set<Holiday>().Add(holiday);
        await _db.SaveChangesAsync();
        return new HolidayDto { Id = holiday.Id, Name = holiday.Name, Date = holiday.Date, IsRestricted = holiday.IsRestricted, Year = holiday.Year };
    }
}
