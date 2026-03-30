using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    private readonly IEmailService _emailService;
    private readonly ILogger<LeaveService> _logger;

    public LeaveService(AppDbContext db, IEmailService emailService, ILogger<LeaveService> logger)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
    }

    // ───── Dashboard ─────

    public async Task<LeaveDashboardDto> GetDashboardAsync()
    {
        var now = DateTime.UtcNow;
        var totalRequests = await _db.Set<LeaveRequest>().CountAsync();
        var pendingApprovals = await _db.Set<LeaveRequest>().CountAsync(r => r.Status == ApprovalStatus.Pending);
        var approvedThisMonth = await _db.Set<LeaveRequest>()
            .CountAsync(r => r.Status == ApprovalStatus.Approved && r.ApprovedAt != null && r.ApprovedAt.Value.Month == now.Month && r.ApprovedAt.Value.Year == now.Year);
        var upcomingHolidays = await _db.Set<Holiday>().CountAsync(h => h.Date >= now.Date);
        var activeLeaveTypes = await _db.Set<LeaveType>().CountAsync(t => t.IsActive);

        var recentEntities = await _db.Set<LeaveRequest>()
            .Include(r => r.Employee).Include(r => r.LeaveType)
            .Include(r => r.Approver).Include(r => r.Level1Approver).Include(r => r.Level2Approver)
            .OrderByDescending(r => r.CreatedAt).Take(5)
            .ToListAsync();
        var recent = new List<LeaveRequestDto>();
        foreach (var r in recentEntities)
        {
            var dto = MapToDto(r);
            dto.ResponsibleUserName = await GetResponsibleUserNameAsync(r);
            recent.Add(dto);
        }

        return new LeaveDashboardDto
        {
            TotalRequests = totalRequests,
            PendingApprovals = pendingApprovals,
            ApprovedThisMonth = approvedThisMonth,
            UpcomingHolidays = upcomingHolidays,
            ActiveLeaveTypes = activeLeaveTypes,
            RecentRequests = recent,
        };
    }

    // ───── Leave Requests ─────

    public async Task<PagedResult<LeaveRequestDto>> GetLeaveRequestsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? employeeId = null, DateTime? fromDate = null, DateTime? toDate = null, IReadOnlyList<Guid>? allowedEmployeeIds = null, Guid? excludeEmployeeId = null)
    {
        var query = _db.Set<LeaveRequest>()
            .Include(r => r.Employee)
            .Include(r => r.LeaveType)
            .Include(r => r.Approver)
            .Include(r => r.Level1Approver)
            .Include(r => r.Level2Approver)
            .AsQueryable();

        if (allowedEmployeeIds != null && allowedEmployeeIds.Count > 0)
            query = query.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));

        if (excludeEmployeeId.HasValue)
            query = query.Where(r => r.EmployeeId != excludeEmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ApprovalStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        if (employeeId.HasValue)
            query = query.Where(r => r.EmployeeId == employeeId.Value);

        if (fromDate.HasValue)
            query = query.Where(r => r.StartDate >= fromDate.Value);

        if (toDate.HasValue)
            query = query.Where(r => r.EndDate <= toDate.Value);

        var total = await query.CountAsync();

        var entities = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = new List<LeaveRequestDto>();
        foreach (var r in entities)
        {
            var dto = MapToDto(r);
            dto.ResponsibleUserName = await GetResponsibleUserNameAsync(r);
            items.Add(dto);
        }

        return new PagedResult<LeaveRequestDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == dto.EmployeeId && !e.IsDeleted);
        if (employee is null)
            throw new InvalidOperationException("Employee not found.");

        if (!employee.IsTopOfHierarchy)
        {
            var hasDirectSupervisor = await _db.Set<EmployeeSupervisor>()
                .AnyAsync(s => !s.IsDeleted && s.EmployeeId == dto.EmployeeId && s.ReportingMethod == "Direct");

            if (!hasDirectSupervisor)
                throw new InvalidOperationException("Cannot apply for leave: no direct supervisor is assigned. Please contact HR to assign a supervisor.");
        }

        // Check for overlapping leave requests (any leave type, any active status)
        var hasOverlap = await _db.Set<LeaveRequest>()
            .AnyAsync(r => r.EmployeeId == dto.EmployeeId &&
                (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2 || r.Status == ApprovalStatus.Approved) &&
                r.StartDate <= dto.EndDate && r.EndDate >= dto.StartDate);
        if (hasOverlap)
            throw new InvalidOperationException("Leave already exists for one or more of the selected dates. Please choose different dates.");

        var leaveType = await _db.Set<LeaveType>().AsNoTracking().FirstOrDefaultAsync(lt => lt.Id == dto.LeaveTypeId);
        if (leaveType != null && string.Equals(leaveType.Code, "LT-ANN", StringComparison.OrdinalIgnoreCase))
        {
            var start = dto.StartDate.Date;
            var end = dto.EndDate.Date;
            var calendarSpanDays = (end - start).TotalDays + 1;
            if (calendarSpanDays < 7 || dto.TotalDays < 7)
                throw new InvalidOperationException("Annual leave must be at least 7 consecutive calendar days with at least 7 leave days (Shop & Office Act).");
        }

        // Validate leave balance - find balance whose period contains the leave start date
        var startDate = dto.StartDate.Date;
        var balances = await _db.Set<LeaveBalance>()
            .Where(b => b.EmployeeId == dto.EmployeeId && b.LeaveTypeId == dto.LeaveTypeId)
            .ToListAsync();
        var balance = balances.FirstOrDefault(b =>
            b.PeriodStart.HasValue && b.PeriodEnd.HasValue
                ? startDate >= b.PeriodStart.Value.Date && startDate <= b.PeriodEnd.Value.Date
                : b.Year == startDate.Year);
        if (balance is null)
            throw new InvalidOperationException($"No leave balance found for this leave type covering {startDate:d MMM yyyy}. Assign a balance for the relevant period first.");

        var periodStart = balance.PeriodStart ?? new DateTime(balance.Year, 1, 1);
        var periodEnd = balance.PeriodEnd ?? new DateTime(balance.Year, 12, 31);
        var pendingDays = await _db.Set<LeaveRequest>()
            .Where(r => r.EmployeeId == dto.EmployeeId && r.LeaveTypeId == dto.LeaveTypeId &&
                r.StartDate.Date >= periodStart && r.StartDate.Date <= periodEnd &&
                (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2))
            .SumAsync(r => r.TotalDays);
        var effectiveRemaining = balance.Entitled + balance.CarriedForward - balance.Used - pendingDays;
        if (dto.TotalDays > effectiveRemaining)
            throw new InvalidOperationException($"Insufficient leave balance. Available: {effectiveRemaining:F1} days, requested: {dto.TotalDays:F1} days.");

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

        var result = MapToDto(created);

        var recipientEmail = await ResolveLeaveNotificationEmailAsync(employee.Id, employee.Email);
        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            _logger.LogInformation(
                "Leave request {LeaveRequestId} created; no confirmation email (employee has no work email and no linked user email).",
                request.Id);
        }
        else
        {
            try
            {
                await _emailService.SendLeaveApplicationConfirmationAsync(
                    recipientEmail,
                    employee.FullName,
                    created.LeaveType?.Name ?? "Leave",
                    created.StartDate,
                    created.EndDate,
                    created.TotalDays,
                    created.Status.ToString(),
                    created.Reason);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Leave request {LeaveRequestId} saved but confirmation email to {Email} failed.", request.Id, recipientEmail);
            }
        }

        return result;
    }

    public async Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null) return null;
        if (request.Status != ApprovalStatus.Pending && request.Status != ApprovalStatus.PendingLevel2) return null;

        var maxLevels = await GetApprovalLevels();
        var now = DateTime.UtcNow;

        if (request.CurrentApprovalLevel == 1)
        {
            request.Level1ApproverId = approverId;
            request.Level1Remarks = dto.Remarks;
            request.Level1ApprovedAt = now;

            if (maxLevels >= 2)
            {
                var l1SupervisorId = await GetDirectSupervisorIdAsync(approverId);
                if (l1SupervisorId.HasValue)
                {
                    request.Status = ApprovalStatus.PendingLevel2;
                    request.CurrentApprovalLevel = 2;
                }
                else
                {
                    request.Status = ApprovalStatus.Approved;
                    request.ApproverId = approverId;
                    request.ApproverRemarks = dto.Remarks;
                    request.ApprovedAt = now;
                }
            }
            else
            {
                request.Status = ApprovalStatus.Approved;
                request.ApproverId = approverId;
                request.ApproverRemarks = dto.Remarks;
                request.ApprovedAt = now;
            }
        }
        else if (request.CurrentApprovalLevel == 2)
        {
            request.Level2ApproverId = approverId;
            request.Level2Remarks = dto.Remarks;
            request.Level2ApprovedAt = now;
            request.Status = ApprovalStatus.Approved;
            request.ApproverId = approverId;
            request.ApproverRemarks = dto.Remarks;
            request.ApprovedAt = now;
        }

        if (request.Status == ApprovalStatus.Approved)
        {
            var startDate = request.StartDate.Date;
            var balances = await _db.Set<LeaveBalance>()
                .Where(b => b.EmployeeId == request.EmployeeId && b.LeaveTypeId == request.LeaveTypeId)
                .ToListAsync();
            var bal = balances.FirstOrDefault(b =>
                b.PeriodStart.HasValue && b.PeriodEnd.HasValue
                    ? startDate >= b.PeriodStart.Value.Date && startDate <= b.PeriodEnd.Value.Date
                    : b.Year == startDate.Year);
            if (bal != null)
                bal.Used += request.TotalDays;
        }

        await _db.SaveChangesAsync();

        return await GetLeaveRequestByIdAsync(id);
    }

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null) return null;
        if (request.Status != ApprovalStatus.Pending && request.Status != ApprovalStatus.PendingLevel2) return null;

        if (request.CurrentApprovalLevel == 1)
        {
            request.Level1ApproverId = approverId;
            request.Level1Remarks = dto.Remarks;
        }
        else
        {
            request.Level2ApproverId = approverId;
            request.Level2Remarks = dto.Remarks;
        }

        request.Status = ApprovalStatus.Rejected;
        request.ApproverId = approverId;
        request.ApproverRemarks = dto.Remarks;
        await _db.SaveChangesAsync();

        return await GetLeaveRequestByIdAsync(id);
    }

    /// <summary>Work email on the employee record, or login email from a user linked to that employee.</summary>
    private async Task<string?> ResolveLeaveNotificationEmailAsync(Guid employeeId, string? employeeWorkEmail)
    {
        if (!string.IsNullOrWhiteSpace(employeeWorkEmail))
            return employeeWorkEmail.Trim();

        var userEmail = await _db.Users.AsNoTracking()
            .Where(u => u.EmployeeId == employeeId && !u.IsDeleted && !string.IsNullOrWhiteSpace(u.Email))
            .OrderByDescending(u => u.IsActive)
            .ThenByDescending(u => u.LastLoginAt)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

        return string.IsNullOrWhiteSpace(userEmail) ? null : userEmail.Trim();
    }

    private async Task<int> GetApprovalLevels()
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LeaveApprovalLevels");
        return int.TryParse(setting?.Value, out var levels) && levels >= 1 && levels <= 2 ? levels : 1;
    }

    private async Task<Guid?> GetDirectSupervisorIdAsync(Guid employeeId)
    {
        var id = await _db.Set<EmployeeSupervisor>()
            .Where(es => !es.IsDeleted && es.EmployeeId == employeeId && es.ReportingMethod == "Direct")
            .Select(es => es.SupervisorId)
            .FirstOrDefaultAsync();
        if (id != default) return id;
        var emp = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted);
        return emp?.ManagerId;
    }

    private async Task<LeaveRequestDto?> GetLeaveRequestByIdAsync(Guid id)
    {
        var r = await _db.Set<LeaveRequest>()
            .Include(x => x.Employee).Include(x => x.LeaveType)
            .Include(x => x.Approver).Include(x => x.Level1Approver).Include(x => x.Level2Approver)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return null;
        var dto = MapToDto(r);
        dto.ResponsibleUserName = await GetResponsibleUserNameAsync(r);
        return dto;
    }

    private static LeaveRequestDto MapToDto(LeaveRequest r) => new()
    {
        Id = r.Id,
        EmployeeName = r.Employee.FirstName + " " + r.Employee.LastName,
        EmployeeCode = r.Employee.EmployeeCode,
        EmployeeId = r.EmployeeId,
        LeaveTypeName = r.LeaveType.Name,
        StartDate = r.StartDate, EndDate = r.EndDate, TotalDays = r.TotalDays,
        Reason = r.Reason, Status = r.Status.ToString(),
        CoveragePerson = r.CoveragePerson, ApproverRemarks = r.ApproverRemarks,
        CreatedAt = r.CreatedAt,
        CurrentApprovalLevel = r.CurrentApprovalLevel,
        Level1ApproverId = r.Level1ApproverId,
        Level1ApproverName = r.Level1Approver != null ? r.Level1Approver.FirstName + " " + r.Level1Approver.LastName : null,
        Level1Remarks = r.Level1Remarks,
        Level1ApprovedAt = r.Level1ApprovedAt,
        Level2ApproverId = r.Level2ApproverId,
        Level2ApproverName = r.Level2Approver != null ? r.Level2Approver.FirstName + " " + r.Level2Approver.LastName : null,
        Level2Remarks = r.Level2Remarks,
        Level2ApprovedAt = r.Level2ApprovedAt,
        ApproverName = r.Approver != null ? r.Approver.FirstName + " " + r.Approver.LastName : null,
    };

    private async Task<string?> GetResponsibleUserNameAsync(LeaveRequest r)
    {
        if (r.Status == ApprovalStatus.Approved)
            return r.Level2Approver != null ? r.Level2Approver.FirstName + " " + r.Level2Approver.LastName : r.Level1Approver != null ? r.Level1Approver.FirstName + " " + r.Level1Approver.LastName : r.Approver != null ? r.Approver.FirstName + " " + r.Approver.LastName : null;
        if (r.Status == ApprovalStatus.Rejected)
            return r.Approver != null ? r.Approver.FirstName + " " + r.Approver.LastName : null;
        if (r.Status == ApprovalStatus.Pending)
        {
            var supervisorId = await GetDirectSupervisorIdAsync(r.EmployeeId);
            if (!supervisorId.HasValue) return null;
            var emp = await _db.Employees.FindAsync(supervisorId.Value);
            return emp != null ? emp.FirstName + " " + emp.LastName : null;
        }
        if (r.Status == ApprovalStatus.PendingLevel2 && r.Level1ApproverId.HasValue)
        {
            var supervisorId = await GetDirectSupervisorIdAsync(r.Level1ApproverId.Value);
            if (!supervisorId.HasValue) return null;
            var emp = await _db.Employees.FindAsync(supervisorId.Value);
            return emp != null ? emp.FirstName + " " + emp.LastName : null;
        }
        return null;
    }

    // ───── Leave Types ─────

    public async Task<List<LeaveTypeDto>> GetLeaveTypesAsync()
    {
        return await _db.Set<LeaveType>()
            .OrderBy(t => t.Name)
            .Select(t => new LeaveTypeDto
            {
                Id = t.Id, Name = t.Name, Code = t.Code, Description = t.Description,
                DefaultDaysPerYear = t.DefaultDaysPerYear, IsPaid = t.IsPaid, IsActive = t.IsActive
            })
            .ToListAsync();
    }

    public async Task<LeaveTypeDto> CreateLeaveTypeAsync(CreateLeaveTypeDto dto)
    {
        var entity = new LeaveType
        {
            Name = dto.Name, Code = dto.Code, Description = dto.Description,
            DefaultDaysPerYear = dto.DefaultDaysPerYear, IsPaid = dto.IsPaid, IsActive = dto.IsActive,
        };
        _db.Set<LeaveType>().Add(entity);
        await _db.SaveChangesAsync();
        return new LeaveTypeDto { Id = entity.Id, Name = entity.Name, Code = entity.Code, Description = entity.Description, DefaultDaysPerYear = entity.DefaultDaysPerYear, IsPaid = entity.IsPaid, IsActive = entity.IsActive };
    }

    public async Task<LeaveTypeDto?> UpdateLeaveTypeAsync(Guid id, UpdateLeaveTypeDto dto)
    {
        var entity = await _db.Set<LeaveType>().FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name; entity.Code = dto.Code; entity.Description = dto.Description;
        entity.DefaultDaysPerYear = dto.DefaultDaysPerYear; entity.IsPaid = dto.IsPaid; entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return new LeaveTypeDto { Id = entity.Id, Name = entity.Name, Code = entity.Code, Description = entity.Description, DefaultDaysPerYear = entity.DefaultDaysPerYear, IsPaid = entity.IsPaid, IsActive = entity.IsActive };
    }

    public async Task<bool> DeleteLeaveTypeAsync(Guid id)
    {
        var entity = await _db.Set<LeaveType>().FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ───── Leave Policies ─────

    public async Task<List<LeavePolicyDto>> GetLeavePoliciesAsync()
    {
        return await _db.Set<LeavePolicy>()
            .Include(p => p.LeaveType)
            .OrderBy(p => p.Name)
            .Select(p => new LeavePolicyDto
            {
                Id = p.Id, Name = p.Name, Description = p.Description,
                MaxDaysPerYear = p.MaxDaysPerYear, AllowCarryForward = p.AllowCarryForward,
                MaxCarryForwardDays = p.MaxCarryForwardDays, AllowEncashment = p.AllowEncashment,
                RequiresApproval = p.RequiresApproval, LeaveTypeId = p.LeaveTypeId,
                LeaveTypeName = p.LeaveType.Name,
            })
            .ToListAsync();
    }

    public async Task<LeavePolicyDto> CreateLeavePolicyAsync(CreateLeavePolicyDto dto)
    {
        var entity = new LeavePolicy
        {
            Name = dto.Name, Description = dto.Description, MaxDaysPerYear = dto.MaxDaysPerYear,
            AllowCarryForward = dto.AllowCarryForward, MaxCarryForwardDays = dto.MaxCarryForwardDays,
            AllowEncashment = dto.AllowEncashment, RequiresApproval = dto.RequiresApproval,
            LeaveTypeId = dto.LeaveTypeId,
        };
        _db.Set<LeavePolicy>().Add(entity);
        await _db.SaveChangesAsync();
        var lt = await _db.Set<LeaveType>().FindAsync(entity.LeaveTypeId);
        return new LeavePolicyDto
        {
            Id = entity.Id, Name = entity.Name, Description = entity.Description,
            MaxDaysPerYear = entity.MaxDaysPerYear, AllowCarryForward = entity.AllowCarryForward,
            MaxCarryForwardDays = entity.MaxCarryForwardDays, AllowEncashment = entity.AllowEncashment,
            RequiresApproval = entity.RequiresApproval, LeaveTypeId = entity.LeaveTypeId,
            LeaveTypeName = lt?.Name ?? "",
        };
    }

    public async Task<LeavePolicyDto?> UpdateLeavePolicyAsync(Guid id, UpdateLeavePolicyDto dto)
    {
        var entity = await _db.Set<LeavePolicy>().FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name; entity.Description = dto.Description; entity.MaxDaysPerYear = dto.MaxDaysPerYear;
        entity.AllowCarryForward = dto.AllowCarryForward; entity.MaxCarryForwardDays = dto.MaxCarryForwardDays;
        entity.AllowEncashment = dto.AllowEncashment; entity.RequiresApproval = dto.RequiresApproval;
        entity.LeaveTypeId = dto.LeaveTypeId;
        await _db.SaveChangesAsync();
        var lt = await _db.Set<LeaveType>().FindAsync(entity.LeaveTypeId);
        return new LeavePolicyDto
        {
            Id = entity.Id, Name = entity.Name, Description = entity.Description,
            MaxDaysPerYear = entity.MaxDaysPerYear, AllowCarryForward = entity.AllowCarryForward,
            MaxCarryForwardDays = entity.MaxCarryForwardDays, AllowEncashment = entity.AllowEncashment,
            RequiresApproval = entity.RequiresApproval, LeaveTypeId = entity.LeaveTypeId,
            LeaveTypeName = lt?.Name ?? "",
        };
    }

    public async Task<bool> DeleteLeavePolicyAsync(Guid id)
    {
        var entity = await _db.Set<LeavePolicy>().FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ───── Leave Balances ─────

    private static string GetPeriodLabel(LeaveBalance b)
    {
        if (b.PeriodStart.HasValue && b.PeriodEnd.HasValue)
            return $"{b.PeriodStart.Value:d MMM yyyy} – {b.PeriodEnd.Value:d MMM yyyy}";
        return b.Year.ToString();
    }

    private static bool PeriodOverlaps(DateTime startA, DateTime endA, DateTime startB, DateTime endB)
        => startA <= endB && startB <= endA;

    public async Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year)
    {
        var yearStart = new DateTime(year, 1, 1);
        var yearEnd = new DateTime(year, 12, 31);
        var list = await _db.Set<LeaveBalance>()
            .Include(b => b.LeaveType)
            .Where(b => b.EmployeeId == employeeId && (
                (b.PeriodStart == null && b.Year == year) ||
                (b.PeriodStart != null && b.PeriodEnd != null && b.PeriodStart <= yearEnd && b.PeriodEnd >= yearStart)))
            .ToListAsync();
        return list.Select(b => new LeaveBalanceDto
        {
            Id = b.Id, LeaveTypeName = b.LeaveType.Name, Year = b.Year,
            PeriodStart = b.PeriodStart, PeriodEnd = b.PeriodEnd, PeriodLabel = GetPeriodLabel(b),
            Entitled = b.Entitled, Used = b.Used, CarriedForward = b.CarriedForward,
            Remaining = b.Entitled + b.CarriedForward - b.Used
        }).ToList();
    }

    public async Task<List<LeaveBalanceSummaryDto>> GetBalanceSummaryAsync(int year)
    {
        var yearStart = new DateTime(year, 1, 1);
        var yearEnd = new DateTime(year, 12, 31);
        var employees = await _db.Set<Employee>()
            .Where(e => !e.IsDeleted)
            .OrderBy(e => e.FirstName)
            .Select(e => new { e.Id, e.FirstName, e.LastName, e.EmployeeCode })
            .ToListAsync();

        var balances = await _db.Set<LeaveBalance>()
            .Include(b => b.LeaveType)
            .Where(b => (b.PeriodStart == null && b.Year == year) ||
                (b.PeriodStart != null && b.PeriodEnd != null && b.PeriodStart <= yearEnd && b.PeriodEnd >= yearStart))
            .ToListAsync();

        return employees.Select(e => new LeaveBalanceSummaryDto
        {
            EmployeeId = e.Id,
            EmployeeName = $"{e.FirstName} {e.LastName}",
            EmployeeCode = e.EmployeeCode,
            Balances = balances.Where(b => b.EmployeeId == e.Id).Select(b => new LeaveBalanceDto
            {
                Id = b.Id, LeaveTypeName = b.LeaveType.Name, Year = b.Year,
                PeriodStart = b.PeriodStart, PeriodEnd = b.PeriodEnd, PeriodLabel = GetPeriodLabel(b),
                Entitled = b.Entitled, Used = b.Used, CarriedForward = b.CarriedForward,
                Remaining = b.Entitled + b.CarriedForward - b.Used,
            }).ToList(),
        }).Where(s => s.Balances.Count > 0).ToList();
    }

    public async Task<LeaveBalanceDto> CreateLeaveBalanceAsync(CreateLeaveBalanceDto dto)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == dto.EmployeeId && !e.IsDeleted);
        if (employee is null)
            throw new InvalidOperationException("Employee not found.");
        var leaveType = await _db.Set<LeaveType>().FirstOrDefaultAsync(lt => lt.Id == dto.LeaveTypeId && !lt.IsDeleted);
        if (leaveType is null)
            throw new InvalidOperationException("Leave type not found.");

        DateTime periodStart;
        DateTime periodEnd;
        int year;
        if (dto.PeriodStart.HasValue && dto.PeriodEnd.HasValue)
        {
            periodStart = dto.PeriodStart.Value.Date;
            periodEnd = dto.PeriodEnd.Value.Date;
            if (periodStart > periodEnd)
                throw new InvalidOperationException("Period start must be before or equal to period end.");
            year = periodStart.Year;
        }
        else if (dto.Year.HasValue && dto.Year.Value >= 2000 && dto.Year.Value <= 2100)
        {
            year = dto.Year.Value;
            periodStart = new DateTime(year, 1, 1);
            periodEnd = new DateTime(year, 12, 31);
        }
        else
            throw new InvalidOperationException("Either Year or both Period start and end dates are required.");

        var existing = await _db.Set<LeaveBalance>()
            .Where(b => b.EmployeeId == dto.EmployeeId && b.LeaveTypeId == dto.LeaveTypeId)
            .ToListAsync();
        foreach (var b in existing)
        {
            var exStart = b.PeriodStart ?? new DateTime(b.Year, 1, 1);
            var exEnd = b.PeriodEnd ?? new DateTime(b.Year, 12, 31);
            if (PeriodOverlaps(periodStart, periodEnd, exStart, exEnd))
                throw new InvalidOperationException($"A balance for this leave type already exists for an overlapping period. Use Edit to update it.");
        }

        var balance = new LeaveBalance
        {
            EmployeeId = dto.EmployeeId,
            LeaveTypeId = dto.LeaveTypeId,
            Year = year,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            Entitled = dto.Entitled,
            Used = dto.Used,
            CarriedForward = dto.CarriedForward,
        };
        _db.Set<LeaveBalance>().Add(balance);
        await _db.SaveChangesAsync();

        return new LeaveBalanceDto
        {
            Id = balance.Id,
            LeaveTypeName = leaveType.Name,
            Year = balance.Year,
            PeriodStart = balance.PeriodStart,
            PeriodEnd = balance.PeriodEnd,
            PeriodLabel = GetPeriodLabel(balance),
            Entitled = balance.Entitled,
            Used = balance.Used,
            CarriedForward = balance.CarriedForward,
            Remaining = balance.Entitled + balance.CarriedForward - balance.Used,
        };
    }

    public async Task<LeaveBalanceDto?> UpdateLeaveBalanceAsync(Guid id, UpdateLeaveBalanceDto dto)
    {
        var balance = await _db.Set<LeaveBalance>().Include(b => b.LeaveType).FirstOrDefaultAsync(b => b.Id == id);
        if (balance is null) return null;
        balance.Entitled = dto.Entitled;
        balance.Used = dto.Used;
        balance.CarriedForward = dto.CarriedForward;
        await _db.SaveChangesAsync();
        return new LeaveBalanceDto
        {
            Id = balance.Id,
            LeaveTypeName = balance.LeaveType.Name,
            Year = balance.Year,
            PeriodStart = balance.PeriodStart,
            PeriodEnd = balance.PeriodEnd,
            PeriodLabel = GetPeriodLabel(balance),
            Entitled = balance.Entitled,
            Used = balance.Used,
            CarriedForward = balance.CarriedForward,
            Remaining = balance.Entitled + balance.CarriedForward - balance.Used,
        };
    }

    /// <summary>
    /// Processes leave carry forward from one year to the next. Run at the beginning of a new year.
    /// Only leave types with AllowCarryForward in policy are processed. Carried days = min(remaining, MaxCarryForwardDays).
    /// </summary>
    public async Task<CarryForwardResult> ProcessCarryForwardAsync(int fromYear, int toYear)
    {
        if (toYear != fromYear + 1)
            throw new InvalidOperationException("Carry forward is only allowed from one year to the next (e.g. 2025 → 2026).");

        var policies = await _db.Set<LeavePolicy>()
            .Where(p => !p.IsDeleted && p.AllowCarryForward && p.MaxCarryForwardDays > 0)
            .Select(p => new { p.LeaveTypeId, p.MaxCarryForwardDays })
            .ToListAsync();

        if (policies.Count == 0)
            return new CarryForwardResult { FromYear = fromYear, ToYear = toYear, BalancesProcessed = 0, BalancesUpdated = 0, BalancesCreated = 0, TotalDaysCarried = 0 };

        var policyByLeaveType = policies.GroupBy(p => p.LeaveTypeId).ToDictionary(g => g.Key, g => g.First().MaxCarryForwardDays);

        var fromBalances = await _db.Set<LeaveBalance>()
            .Where(b => b.Year == fromYear && policyByLeaveType.ContainsKey(b.LeaveTypeId))
            .ToListAsync();

        int created = 0, updated = 0;
        decimal totalCarried = 0;

        var toYearStart = new DateTime(toYear, 1, 1);
        var toYearEnd = new DateTime(toYear, 12, 31);

        foreach (var fromBal in fromBalances)
        {
            var maxCarry = policyByLeaveType[fromBal.LeaveTypeId];
            var remaining = fromBal.Entitled + fromBal.CarriedForward - fromBal.Used;
            if (remaining <= 0) continue;

            var carryDays = Math.Min(remaining, (decimal)maxCarry);
            if (carryDays <= 0) continue;

            var toBalance = await _db.Set<LeaveBalance>()
                .FirstOrDefaultAsync(b => b.EmployeeId == fromBal.EmployeeId && b.LeaveTypeId == fromBal.LeaveTypeId && b.Year == toYear);

            if (toBalance != null)
            {
                toBalance.CarriedForward = carryDays;
                updated++;
            }
            else
            {
                _db.Set<LeaveBalance>().Add(new LeaveBalance
                {
                    EmployeeId = fromBal.EmployeeId,
                    LeaveTypeId = fromBal.LeaveTypeId,
                    Year = toYear,
                    PeriodStart = toYearStart,
                    PeriodEnd = toYearEnd,
                    Entitled = 0,
                    Used = 0,
                    CarriedForward = carryDays,
                });
                created++;
            }
            totalCarried += carryDays;
        }

        await _db.SaveChangesAsync();

        return new CarryForwardResult
        {
            FromYear = fromYear,
            ToYear = toYear,
            BalancesProcessed = fromBalances.Count,
            BalancesUpdated = updated,
            BalancesCreated = created,
            TotalDaysCarried = totalCarried,
        };
    }

    // ───── Holidays ─────

    public async Task<List<HolidayDto>> GetHolidaysAsync(int year)
    {
        return await _db.Set<Holiday>()
            .Where(h => h.Year == year)
            .OrderBy(h => h.Date)
            .Select(h => new HolidayDto { Id = h.Id, Name = h.Name, Date = h.Date, IsRestricted = h.IsRestricted, Description = h.Description, Year = h.Year })
            .ToListAsync();
    }

    public async Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto)
    {
        var holiday = new Holiday { Name = dto.Name, Date = dto.Date, IsRestricted = dto.IsRestricted, Description = dto.Description, Year = dto.Year };
        _db.Set<Holiday>().Add(holiday);
        await _db.SaveChangesAsync();
        return new HolidayDto { Id = holiday.Id, Name = holiday.Name, Date = holiday.Date, IsRestricted = holiday.IsRestricted, Description = holiday.Description, Year = holiday.Year };
    }

    public async Task<HolidayDto?> UpdateHolidayAsync(Guid id, UpdateHolidayDto dto)
    {
        var entity = await _db.Set<Holiday>().FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name; entity.Date = dto.Date; entity.IsRestricted = dto.IsRestricted;
        entity.Description = dto.Description; entity.Year = dto.Year;
        await _db.SaveChangesAsync();
        return new HolidayDto { Id = entity.Id, Name = entity.Name, Date = entity.Date, IsRestricted = entity.IsRestricted, Description = entity.Description, Year = entity.Year };
    }

    public async Task<bool> DeleteHolidayAsync(Guid id)
    {
        var entity = await _db.Set<Holiday>().FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ───── Calendar ─────

    public async Task<List<CalendarDayDto>> GetCalendarAsync(int month, int year)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var requests = await _db.Set<LeaveRequest>()
            .Include(r => r.Employee).Include(r => r.LeaveType)
            .Where(r => r.Status == ApprovalStatus.Approved && r.StartDate < end && r.EndDate >= start)
            .ToListAsync();

        var days = new Dictionary<DateTime, CalendarDayDto>();
        foreach (var r in requests)
        {
            for (var d = r.StartDate.Date; d <= r.EndDate.Date; d = d.AddDays(1))
            {
                if (d.Month != month || d.Year != year) continue;
                var key = d.Date;
                if (!days.ContainsKey(key))
                    days[key] = new CalendarDayDto { Date = key };
                days[key].Entries.Add(new CalendarEntryDto
                {
                    EmployeeName = $"{r.Employee.FirstName} {r.Employee.LastName}",
                    LeaveTypeName = r.LeaveType.Name,
                    Status = r.Status.ToString(),
                });
            }
        }

        return days.Values.OrderBy(d => d.Date).ToList();
    }
}
