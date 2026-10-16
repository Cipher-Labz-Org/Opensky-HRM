using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class LeaveService : ILeaveService
{
    private const string CarryForwardAvailabilityMonthsKey = "CarryForwardAvailabilityMonths";
    private const string CarryForwardNarrativeKey = "CarryForwardNarrativeJson";

    private readonly AppDbContext _db;
    private readonly IEmailService _emailService;
    private readonly ILogger<LeaveService> _logger;
    private readonly ISystemSettingService _systemSettings;
    private readonly IBusinessClock _clock;
    private readonly ILeaveEntitlementService _entitlementService;

    public LeaveService(
        AppDbContext db,
        IEmailService emailService,
        ILogger<LeaveService> logger,
        ISystemSettingService systemSettings,
        IBusinessClock clock,
        ILeaveEntitlementService entitlementService)
    {
        _db = db;
        _emailService = emailService;
        _logger = logger;
        _systemSettings = systemSettings;
        _clock = clock;
        _entitlementService = entitlementService;
    }

    // ───── Dashboard ─────

    public async Task<LeaveDashboardDto> GetDashboardAsync()
    {
        var now = DateTime.UtcNow;
        var totalRequests = await _db.Set<LeaveRequest>().CountAsync();
        var pendingApprovals = await _db.Set<LeaveRequest>().CountAsync(r =>
            r.Status == ApprovalStatus.Pending
            || r.Status == ApprovalStatus.PendingLevel2
            || r.Status == ApprovalStatus.CancellationRequested);
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
            if (r.Employee is null || r.LeaveType is null)
                continue;
            var dto = MapToDto(r);
            await SetResponsibleFieldsAsync(dto, r);
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
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 500);

        var query = _db.Set<LeaveRequest>()
            .AsNoTracking()
            .Include(r => r.Employee)
            .Include(r => r.LeaveType)
            .Include(r => r.Approver)
            .Include(r => r.Level1Approver)
            .Include(r => r.Level2Approver)
            .AsQueryable();

        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                return new PagedResult<LeaveRequestDto> { Items = [], TotalCount = 0, Page = page, PageSize = pageSize };
            query = query.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));
        }

        if (excludeEmployeeId.HasValue)
            query = query.Where(r => r.EmployeeId != excludeEmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<ApprovalStatus>(status, true, out var s))
            query = query.Where(r => r.Status == s);

        if (employeeId.HasValue)
            query = query.Where(r => r.EmployeeId == employeeId.Value);

        var rangeFrom = fromDate.HasValue
            ? DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Unspecified)
            : (DateTime?)null;
        var rangeTo = toDate.HasValue
            ? DateTime.SpecifyKind(toDate.Value.Date, DateTimeKind.Unspecified)
            : (DateTime?)null;
        if (rangeFrom.HasValue && rangeTo.HasValue && rangeTo.Value < rangeFrom.Value)
            (rangeFrom, rangeTo) = (rangeTo, rangeFrom);

        // Compare timestamps directly — DateTime.Date in LINQ is not reliably translated
        // for PostgreSQL timestamp without time zone and can 500 the list endpoint.
        if (rangeFrom.HasValue && rangeTo.HasValue)
        {
            var toExclusive = rangeTo.Value.AddDays(1);
            query = query.Where(r => r.StartDate < toExclusive && r.EndDate >= rangeFrom.Value);
        }
        else if (rangeFrom.HasValue)
            query = query.Where(r => r.EndDate >= rangeFrom.Value);
        else if (rangeTo.HasValue)
        {
            var toExclusive = rangeTo.Value.AddDays(1);
            query = query.Where(r => r.StartDate < toExclusive);
        }

        var total = await query.CountAsync();

        var entities = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = new List<LeaveRequestDto>();
        foreach (var r in entities)
        {
            if (r.Employee is null || r.LeaveType is null)
                continue;
            var dto = MapToDto(r);
            await SetResponsibleFieldsAsync(dto, r);
            items.Add(dto);
        }

        return new PagedResult<LeaveRequestDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto, string? medicalCertificateUrl = null)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == dto.EmployeeId && !e.IsDeleted);
        if (employee is null)
            throw new InvalidOperationException("Employee not found.");

        if (!employee.IsTopOfHierarchy)
        {
            var hasDirectSupervisor = await _db.Set<EmployeeSupervisor>()
                .AnyAsync(s => !s.IsDeleted && s.EmployeeId == dto.EmployeeId
                    && (s.ReportingMethod == "Direct" || s.ReportingMethod == "Both"));

            if (!hasDirectSupervisor)
                throw new InvalidOperationException("Cannot apply for leave: no direct supervisor is assigned. Please contact HR to assign a supervisor.");
        }

        // Check for overlapping leave requests (any leave type, any active status)
        var hasOverlap = await _db.Set<LeaveRequest>()
            .AnyAsync(r => r.EmployeeId == dto.EmployeeId &&
                (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2 || r.Status == ApprovalStatus.Approved || r.Status == ApprovalStatus.CancellationRequested) &&
                r.StartDate <= dto.EndDate && r.EndDate >= dto.StartDate);
        if (hasOverlap)
            throw new InvalidOperationException("Leave already exists for one or more of the selected dates. Please choose different dates.");

        if (dto.EndDate.Date < dto.StartDate.Date)
            throw new InvalidOperationException("End date cannot be before start date.");

        if (string.IsNullOrWhiteSpace(dto.Reason))
            throw new InvalidOperationException("Comments are required.");

        var leaveType = await _db.Set<LeaveType>().AsNoTracking().FirstOrDefaultAsync(lt => lt.Id == dto.LeaveTypeId && !lt.IsDeleted);
        if (leaveType is null)
            throw new InvalidOperationException("Leave type not found.");

        var durationKind = LeaveDurationRules.IsShortLeaveType(leaveType.Code, leaveType.AllowShortLeave)
            ? LeaveDurationKinds.ShortLeave
            : LeaveDurationRules.NormalizeKind(dto.DurationKind);

        decimal? requestedShortLeaveHours = dto.ShortLeaveHours;
        LeaveDurationRules.NormalizeShortLeaveTimes(
            dto.ShortLeaveStartTime, dto.ShortLeaveEndTime, out var storedShortLeaveStart, out var storedShortLeaveEnd);
        if (storedShortLeaveStart is not null && storedShortLeaveEnd is not null)
            requestedShortLeaveHours = LeaveDurationRules.HoursBetweenTimes(storedShortLeaveStart, storedShortLeaveEnd);

        var totalDays = LeaveDurationRules.ResolveTotalDays(
            durationKind,
            dto.StartDate,
            dto.EndDate,
            leaveType.AllowHalfDay,
            leaveType.AllowShortLeave,
            leaveType.ShortLeaveHours,
            dto.HalfDayPeriod,
            requestedShortLeaveHours,
            out var storedHalfDayPeriod,
            out var storedShortLeaveHours);

        if (durationKind == LeaveDurationKinds.ShortLeave)
        {
            LeaveDurationRules.EnsureWithinMinMaxHours(storedShortLeaveHours ?? leaveType.ShortLeaveHours, leaveType.MinHours, leaveType.MaxHours);
            if (storedShortLeaveStart is null || storedShortLeaveEnd is null)
                throw new InvalidOperationException("Select start and end times for short leave.");
        }
        else
            LeaveDurationRules.EnsureWithinMinMax(totalDays, leaveType.MinDays, leaveType.MaxDays, durationKind);

        var isSickLeave = string.Equals(leaveType.Code, "LT-SIC", StringComparison.OrdinalIgnoreCase);
        var sickLeaveRequiresMedicalPdf = isSickLeave && totalDays > 2;
        if (sickLeaveRequiresMedicalPdf && string.IsNullOrWhiteSpace(medicalCertificateUrl))
            throw new InvalidOperationException("A medical certificate (PDF) is required for sick leave longer than 2 days.");

        if (!isSickLeave)
            medicalCertificateUrl = null;

        var skipEntireBalanceCheck =
            string.Equals(leaveType.Code, "LT-NPL", StringComparison.OrdinalIgnoreCase)
            || LeaveDurationRules.IsShortLeaveType(leaveType.Code, leaveType.AllowShortLeave);
        /** Sick leave may be submitted even when no balance row exists; maternity requires HR assignment (balance). */
        var allowsMissingBalance = string.Equals(leaveType.Code, "LT-SIC", StringComparison.OrdinalIgnoreCase);
        var startDate = dto.StartDate.Date;

        if (!skipEntireBalanceCheck)
        {
            var balances = await _db.Set<LeaveBalance>()
                .Include(b => b.LeaveType)
                .Where(b => b.EmployeeId == dto.EmployeeId && b.LeaveTypeId == dto.LeaveTypeId)
                .ToListAsync();
            var balance = balances.FirstOrDefault(b =>
                b.PeriodStart.HasValue && b.PeriodEnd.HasValue
                    ? startDate >= b.PeriodStart.Value.Date && startDate <= b.PeriodEnd.Value.Date
                    : b.Year == startDate.Year);
            if (balance is null)
            {
                if (!allowsMissingBalance)
                    throw new InvalidOperationException($"No leave balance found for this leave type covering {startDate:d MMM yyyy}. Assign a balance for the relevant period first.");
            }
            else
            {
                var asOf = _clock.Now.Date;
                var avM = await GetCarryForwardAvailabilityMonthsAsync();
                var openingSaved = EnsureBroughtForwardOpeningRecorded(balance);
                var forfeitSaved = TryForfeitCarryAfterWindowEnded(balance, avM, asOf, out var oldCf);
                if (forfeitSaved)
                {
                    _logger.LogInformation(
                        "Forfeited unused carry on balance {BalanceId}: CarriedForward {From} -> {To}.",
                        balance.Id, oldCf, balance.CarriedForward);
                }
                if (openingSaved || forfeitSaved)
                    await _db.SaveChangesAsync();

                var periodStart = balance.PeriodStart ?? new DateTime(balance.Year, 1, 1);
                var periodEnd = balance.PeriodEnd ?? new DateTime(balance.Year, 12, 31);
                var pendingDays = await _db.Set<LeaveRequest>()
                    .Where(r => r.EmployeeId == dto.EmployeeId && r.LeaveTypeId == dto.LeaveTypeId &&
                        r.StartDate.Date >= periodStart && r.StartDate.Date <= periodEnd &&
                        (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2))
                    .SumAsync(r => r.TotalDays);
                var fullRemaining = LeaveBalanceImportRules.ComputeRemaining(balance.Entitled, balance.Used, balance.CarriedForward) - pendingDays;
                decimal effectiveRemaining = fullRemaining;
                if (balance.CarriedForward > 0)
                {
                    var avMonths = await GetCarryForwardAvailabilityMonthsAsync();
                    if (avMonths < 12 && !IsInCarryForwardUseWindow(startDate, balance, avMonths))
                    {
                        var entitledPortion = balance.Entitled - balance.Used - pendingDays;
                        effectiveRemaining = Math.Max(0, entitledPortion);
                        if (totalDays > effectiveRemaining)
                        {
                            var wEnd = GetCarryForwardWindowEndDisplay(balance, avMonths);
                            throw new InvalidOperationException(
                                $"Carried-forward leave is only available during the first {avMonths} month(s) of the balance period (up to {wEnd}). " +
                                $"On this start date, days from carry forward cannot be used; entitlement-only available: {effectiveRemaining:F1} day(s), requested: {totalDays:F1}.");
                        }
                    }
                }

                if (totalDays > effectiveRemaining)
                    throw new InvalidOperationException($"Insufficient leave balance. Available: {effectiveRemaining:F1} days, requested: {totalDays:F1} days.");
            }
        }

        var request = new LeaveRequest
        {
            EmployeeId = dto.EmployeeId,
            LeaveTypeId = dto.LeaveTypeId,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            TotalDays = totalDays,
            DurationKind = durationKind,
            HalfDayPeriod = storedHalfDayPeriod,
            ShortLeaveHours = storedShortLeaveHours,
            ShortLeaveStartTime = storedShortLeaveStart,
            ShortLeaveEndTime = storedShortLeaveEnd,
            Reason = dto.Reason,
            CoveragePerson = dto.CoveragePerson,
            MedicalCertificateUrl = string.IsNullOrWhiteSpace(medicalCertificateUrl) ? null : medicalCertificateUrl.Trim(),
            Status = ApprovalStatus.Pending,
        };

        _db.Set<LeaveRequest>().Add(request);
        await _db.SaveChangesAsync();

        var created = await _db.Set<LeaveRequest>()
            .Include(r => r.Employee).Include(r => r.LeaveType)
            .FirstAsync(r => r.Id == request.Id);

        var result = MapToDto(created);
        await NotifyLeaveApplicationRecipientsAsync(employee, created, dto.CoverageEmployeeId);
        return result;
    }

    public async Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null) return null;

        if (request.Status == ApprovalStatus.CancellationRequested)
        {
            request.ApproverId = approverId;
            request.ApproverRemarks = string.IsNullOrWhiteSpace(dto.Remarks)
                ? "Cancellation approved by supervisor."
                : dto.Remarks.Trim();
            request.ApprovedAt = DateTime.UtcNow;
            await RestoreUsedDaysAsync(request);
            request.Status = ApprovalStatus.Cancelled;
            await _db.SaveChangesAsync();
            return await GetLeaveRequestByIdAsync(id);
        }

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
                .Include(b => b.LeaveType)
                .Where(b => b.EmployeeId == request.EmployeeId && b.LeaveTypeId == request.LeaveTypeId)
                .ToListAsync();
            var bal = balances.FirstOrDefault(b =>
                b.PeriodStart.HasValue && b.PeriodEnd.HasValue
                    ? startDate >= b.PeriodStart.Value.Date && startDate <= b.PeriodEnd.Value.Date
                    : b.Year == startDate.Year);
            if (bal != null)
            {
                bal.Used += request.TotalDays;
                var avM = await GetCarryForwardAvailabilityMonthsAsync();
                EnsureBroughtForwardOpeningRecorded(bal);
                if (TryForfeitCarryAfterWindowEnded(bal, avM, _clock.Now.Date, out var beforeCf))
                    _logger.LogInformation("Carry forfeit on approve for balance {BalanceId}: {From} -> {To}.", bal.Id, beforeCf, bal.CarriedForward);
            }
        }

        await _db.SaveChangesAsync();

        if (request.Status == ApprovalStatus.Approved)
            await NotifyLeaveDecisionToEmployeeAsync(request, approved: true);

        return await GetLeaveRequestByIdAsync(id);
    }

    public async Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id);
        if (request is null) return null;

        if (request.Status == ApprovalStatus.CancellationRequested)
        {
            request.Status = ApprovalStatus.Approved;
            request.ApproverId = approverId;
            request.ApproverRemarks = string.IsNullOrWhiteSpace(dto.Remarks)
                ? "Cancellation request declined. Leave remains approved."
                : dto.Remarks.Trim();
            await _db.SaveChangesAsync();
            return await GetLeaveRequestByIdAsync(id);
        }

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

        await NotifyLeaveDecisionToEmployeeAsync(request, approved: false);

        return await GetLeaveRequestByIdAsync(id);
    }

    public async Task<LeaveRequestDto> CancelLeaveRequestAsync(Guid id, Guid actingEmployeeId, string? remarks)
    {
        var request = await _db.Set<LeaveRequest>().FindAsync(id)
            ?? throw new InvalidOperationException("Leave request not found.");

        var isOwner = request.EmployeeId == actingEmployeeId;
        var supervisorId = await GetDirectSupervisorIdAsync(request.EmployeeId);
        var isSupervisor = supervisorId.HasValue && supervisorId.Value == actingEmployeeId;
        var note = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim();

        if (request.Status is ApprovalStatus.Pending or ApprovalStatus.PendingLevel2)
        {
            if (!isOwner)
                throw new InvalidOperationException("Only the employee can cancel a leave request before it is approved.");
            request.Status = ApprovalStatus.Cancelled;
            request.ApproverRemarks = note ?? "Cancelled by employee before approval.";
            await _db.SaveChangesAsync();
            return (await GetLeaveRequestByIdAsync(id))!;
        }

        if (request.Status == ApprovalStatus.Approved)
        {
            if (isOwner)
            {
                request.Status = ApprovalStatus.CancellationRequested;
                request.ApproverRemarks = note ?? "Employee requested cancellation.";
                await _db.SaveChangesAsync();
                await NotifyLeaveCancellationRequestAsync(request);
                return (await GetLeaveRequestByIdAsync(id))!;
            }

            if (isSupervisor)
            {
                await RestoreUsedDaysAsync(request);
                request.Status = ApprovalStatus.Cancelled;
                request.ApproverId = actingEmployeeId;
                request.ApproverRemarks = note ?? "Cancelled by supervisor. Days returned to leave balance.";
                await _db.SaveChangesAsync();
                return (await GetLeaveRequestByIdAsync(id))!;
            }

            throw new InvalidOperationException("You cannot cancel this leave request.");
        }

        if (request.Status == ApprovalStatus.CancellationRequested)
        {
            if (!isSupervisor)
                throw new InvalidOperationException("This cancellation is waiting for the supervisor.");
            await RestoreUsedDaysAsync(request);
            request.Status = ApprovalStatus.Cancelled;
            request.ApproverId = actingEmployeeId;
            request.ApproverRemarks = note ?? "Cancellation approved by supervisor. Days returned to leave balance.";
            await _db.SaveChangesAsync();
            return (await GetLeaveRequestByIdAsync(id))!;
        }

        throw new InvalidOperationException("This leave request cannot be cancelled.");
    }

    private async Task RestoreUsedDaysAsync(LeaveRequest request)
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
            bal.Used = Math.Max(0, bal.Used - request.TotalDays);
    }

    private async Task NotifyLeaveDecisionToEmployeeAsync(LeaveRequest request, bool approved)
    {
        var decision = approved ? "approved" : "rejected";
        try
        {
            var employee = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted);
            if (employee is null) return;

            var employeeEmail = await ResolveLeaveNotificationEmailAsync(employee.Id, employee.Email, employee.OtherEmail);
            if (string.IsNullOrWhiteSpace(employeeEmail))
            {
                _logger.LogInformation(
                    "Leave request {LeaveRequestId} {Decision}; no employee email (no work or login email).",
                    request.Id, decision);
                return;
            }

            var leaveType = await _db.Set<LeaveType>().AsNoTracking()
                .Where(t => t.Id == request.LeaveTypeId)
                .Select(t => t.Name)
                .FirstOrDefaultAsync() ?? "Leave";

            string? approverName = null;
            if (request.ApproverId.HasValue)
            {
                approverName = await _db.Employees.AsNoTracking()
                    .Where(e => e.Id == request.ApproverId.Value && !e.IsDeleted)
                    .Select(e => e.FirstName + " " + e.LastName)
                    .FirstOrDefaultAsync();
            }

            if (approved)
            {
                await _emailService.SendLeaveApprovedToEmployeeAsync(
                    employeeEmail,
                    employee.FullName,
                    leaveType,
                    request.StartDate,
                    request.EndDate,
                    request.TotalDays,
                    request.ApproverRemarks,
                    approverName);
            }
            else
            {
                await _emailService.SendLeaveRejectedToEmployeeAsync(
                    employeeEmail,
                    employee.FullName,
                    leaveType,
                    request.StartDate,
                    request.EndDate,
                    request.TotalDays,
                    request.ApproverRemarks,
                    approverName);
            }

            _logger.LogInformation(
                "Leave request {LeaveRequestId} {Decision} email sent to {Email}.",
                request.Id, decision, employeeEmail);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Leave request {LeaveRequestId} {Decision}; employee email failed.", request.Id, decision);
        }
    }

    private async Task NotifyLeaveCancellationRequestAsync(LeaveRequest request)
    {
        try
        {
            var employee = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == request.EmployeeId && !e.IsDeleted);
            if (employee is null) return;
            var leaveType = await _db.Set<LeaveType>().AsNoTracking()
                .Where(t => t.Id == request.LeaveTypeId)
                .Select(t => t.Name)
                .FirstOrDefaultAsync() ?? "Leave";
            var supervisorIds = await GetLeaveNotifySupervisorIdsAsync(employee.Id);
            foreach (var supervisorId in supervisorIds)
            {
                var supervisor = await _db.Employees.AsNoTracking()
                    .FirstOrDefaultAsync(e => e.Id == supervisorId && !e.IsDeleted);
                if (supervisor is null) continue;
                var supervisorEmail = await ResolveLeaveNotificationEmailAsync(supervisor.Id, supervisor.Email, supervisor.OtherEmail);
                if (string.IsNullOrWhiteSpace(supervisorEmail)) continue;
                await _emailService.SendLeaveApplicationToSupervisorAsync(
                    supervisorEmail,
                    supervisor.FullName,
                    employee.FullName,
                    leaveType,
                    request.StartDate,
                    request.EndDate,
                    request.TotalDays,
                    "Cancellation requested",
                    request.ApproverRemarks,
                    request.Id);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Leave request {LeaveRequestId} cancellation requested; supervisor email failed.", request.Id);
        }
    }

    /// <summary>Work email on the employee record, then personal email, then login email.</summary>
    private async Task<string?> ResolveLeaveNotificationEmailAsync(
        Guid employeeId, string? employeeWorkEmail, string? personalEmail = null)
    {
        var work = EmployeeEmailHelper.ToDisplayEmail(employeeWorkEmail);
        if (!string.IsNullOrWhiteSpace(work))
            return work;

        var personal = EmployeeEmailHelper.ToDisplayEmail(personalEmail);
        if (!string.IsNullOrWhiteSpace(personal))
            return personal;

        var userEmail = await _db.Users.AsNoTracking()
            .Where(u => u.EmployeeId == employeeId && !u.IsDeleted && !string.IsNullOrWhiteSpace(u.Email))
            .OrderByDescending(u => u.IsActive)
            .ThenByDescending(u => u.LastLoginAt)
            .Select(u => u.Email)
            .FirstOrDefaultAsync();

        return EmployeeEmailHelper.ToDisplayEmail(userEmail);
    }

    private async Task NotifyLeaveApplicationRecipientsAsync(
        Employee employee, LeaveRequest created, Guid? coverageEmployeeId)
    {
        var leaveType = created.LeaveType?.Name ?? "Leave";

        var supervisorIds = await GetLeaveNotifySupervisorIdsAsync(employee.Id);
        if (supervisorIds.Count == 0)
        {
            _logger.LogInformation(
                "Leave request {LeaveRequestId} created; no supervisor email (no supervisor assigned).",
                created.Id);
        }

        foreach (var supervisorId in supervisorIds)
        {
            if (supervisorId == employee.Id) continue;
            var supervisor = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == supervisorId && !e.IsDeleted);
            if (supervisor is null) continue;
            var supervisorEmail = await ResolveLeaveNotificationEmailAsync(supervisor.Id, supervisor.Email, supervisor.OtherEmail);
            if (string.IsNullOrWhiteSpace(supervisorEmail))
            {
                _logger.LogInformation(
                    "Leave request {LeaveRequestId} created; supervisor {SupervisorId} has no work, personal, or login email.",
                    created.Id, supervisor.Id);
                continue;
            }

            // Always send the approval mail, even if this address already received the employee confirmation.
            try
            {
                await _emailService.SendLeaveApplicationToSupervisorAsync(
                    supervisorEmail,
                    supervisor.FullName,
                    employee.FullName,
                    leaveType,
                    created.StartDate,
                    created.EndDate,
                    created.TotalDays,
                    created.Status.ToString(),
                    created.Reason,
                    created.Id);
                _logger.LogInformation(
                    "Leave request {LeaveRequestId} supervisor email sent to {Email}.",
                    created.Id, supervisorEmail);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Leave request {LeaveRequestId} saved but supervisor email to {Email} failed.", created.Id, supervisorEmail);
            }
        }

        var employeeEmail = await ResolveLeaveNotificationEmailAsync(employee.Id, employee.Email, employee.OtherEmail);
        if (string.IsNullOrWhiteSpace(employeeEmail))
        {
            _logger.LogInformation(
                "Leave request {LeaveRequestId} created; no employee confirmation email (no work, personal, or login email).",
                created.Id);
        }
        else
        {
            // Applicant always gets a confirmation, even when that address is also the supervisor.
            try
            {
                await _emailService.SendLeaveApplicationConfirmationAsync(
                    employeeEmail,
                    employee.FullName,
                    leaveType,
                    created.StartDate,
                    created.EndDate,
                    created.TotalDays,
                    created.Status.ToString(),
                    created.Reason);
                _logger.LogInformation(
                    "Leave request {LeaveRequestId} employee email sent to {Email}.",
                    created.Id, employeeEmail);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Leave request {LeaveRequestId} saved but employee email to {Email} failed.", created.Id, employeeEmail);
            }
        }

        var covering = await ResolveCoverageEmployeeAsync(employee.Id, coverageEmployeeId, created.CoveragePerson);
        if (covering is null)
        {
            if (!string.IsNullOrWhiteSpace(created.CoveragePerson))
            {
                _logger.LogInformation(
                    "Leave request {LeaveRequestId} created; covering person {CoveragePerson} could not be matched to an employee email.",
                    created.Id, created.CoveragePerson);
            }
            return;
        }

        var coveringEmail = await ResolveLeaveNotificationEmailAsync(covering.Id, covering.Email, covering.OtherEmail);
        if (string.IsNullOrWhiteSpace(coveringEmail))
        {
            _logger.LogInformation(
                "Leave request {LeaveRequestId} created; covering person {CoveringId} has no work or login email.",
                created.Id, covering.Id);
            return;
        }

        try
        {
            await _emailService.SendLeaveApplicationToCoveringPersonAsync(
                coveringEmail,
                covering.FullName,
                employee.FullName,
                leaveType,
                created.StartDate,
                created.EndDate,
                created.TotalDays,
                created.Status.ToString(),
                created.Reason);
            _logger.LogInformation(
                "Leave request {LeaveRequestId} covering person email sent to {Email}.",
                created.Id, coveringEmail);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Leave request {LeaveRequestId} saved but covering person email to {Email} failed.", created.Id, coveringEmail);
        }
    }

    private async Task<List<Guid>> GetLeaveNotifySupervisorIdsAsync(Guid employeeId)
    {
        var links = await _db.Set<EmployeeSupervisor>()
            .Where(es => !es.IsDeleted && es.EmployeeId == employeeId)
            .Select(es => new { es.SupervisorId, es.ReportingMethod })
            .ToListAsync();

        var ids = links
            .Where(x => ReportingChain.IsDirectMethod(x.ReportingMethod))
            .Select(x => x.SupervisorId)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
            ids = links.Select(x => x.SupervisorId).Distinct().ToList();

        var managerId = await _db.Employees.AsNoTracking()
            .Where(e => e.Id == employeeId && !e.IsDeleted)
            .Select(e => e.ManagerId)
            .FirstOrDefaultAsync();
        if (managerId.HasValue && managerId.Value != employeeId && !ids.Contains(managerId.Value))
            ids.Add(managerId.Value);

        return ids;
    }

    private async Task<Employee?> ResolveCoverageEmployeeAsync(
        Guid applicantId, Guid? coverageEmployeeId, string? coveragePerson)
    {
        if (coverageEmployeeId.HasValue && coverageEmployeeId.Value != applicantId)
        {
            var byId = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == coverageEmployeeId.Value && !e.IsDeleted);
            if (byId != null) return byId;
        }

        var raw = coveragePerson?.Trim();
        if (string.IsNullOrWhiteSpace(raw)) return null;

        string? code = null;
        var open = raw.LastIndexOf('(');
        var close = raw.LastIndexOf(')');
        if (open >= 0 && close > open)
            code = raw[(open + 1)..close].Trim();

        if (!string.IsNullOrWhiteSpace(code))
        {
            var byCode = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => !e.IsDeleted && e.Id != applicantId && e.EmployeeCode == code);
            if (byCode != null) return byCode;
        }

        var name = open >= 0 ? raw[..open].Trim() : raw;
        if (string.IsNullOrWhiteSpace(name)) return null;

        return await _db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(e =>
                !e.IsDeleted
                && e.Id != applicantId
                && (e.FirstName + " " + e.LastName) == name);
    }

    private async Task<int> GetApprovalLevels()
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LeaveApprovalLevels");
        return int.TryParse(setting?.Value, out var levels) && levels >= 1 && levels <= 2 ? levels : 1;
    }

    private async Task<Guid?> GetDirectSupervisorIdAsync(Guid employeeId)
    {
        var links = await _db.Set<EmployeeSupervisor>()
            .Where(es => !es.IsDeleted && es.EmployeeId == employeeId)
            .Select(es => new { es.SupervisorId, es.ReportingMethod, es.CreatedAt })
            .ToListAsync();

        var id = links
            .Where(x => ReportingChain.IsDirectMethod(x.ReportingMethod))
            .OrderByDescending(x => string.Equals(x.ReportingMethod, "Direct", StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => x.SupervisorId)
            .FirstOrDefault();
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
        await SetResponsibleFieldsAsync(dto, r);
        return dto;
    }

    public async Task<Guid?> GetResponsibleApproverEmployeeIdAsync(Guid leaveRequestId)
    {
        var r = await _db.Set<LeaveRequest>().FindAsync(leaveRequestId);
        if (r is null) return null;
        return await GetResponsibleEmployeeIdAsync(r);
    }

    private static LeaveTypeDto MapLeaveType(LeaveType t) => new()
    {
        Id = t.Id,
        Name = t.Name,
        Code = t.Code,
        Description = t.Description,
        DefaultDaysPerYear = t.DefaultDaysPerYear,
        IsPaid = t.IsPaid,
        IsActive = t.IsActive,
        AllowHalfDay = t.AllowHalfDay,
        AllowShortLeave = t.AllowShortLeave,
        ShortLeaveHours = t.ShortLeaveHours,
        MinHours = t.MinHours,
        MaxHours = t.MaxHours,
        MinDays = t.MinDays,
        MaxDays = t.MaxDays,
    };

    private static LeaveRequestDto MapToDto(LeaveRequest r) => new()
    {
        Id = r.Id,
        EmployeeName = r.Employee is null ? "(Former employee)" : r.Employee.FirstName + " " + r.Employee.LastName,
        EmployeeCode = r.Employee?.EmployeeCode ?? string.Empty,
        EmployeeId = r.EmployeeId,
        LeaveTypeName = r.LeaveType?.Name ?? "(Deleted leave type)",
        StartDate = r.StartDate, EndDate = r.EndDate, TotalDays = r.TotalDays,
        DurationKind = string.IsNullOrWhiteSpace(r.DurationKind) ? LeaveDurationKinds.FullDay : r.DurationKind,
        HalfDayPeriod = r.HalfDayPeriod,
        ShortLeaveHours = r.ShortLeaveHours,
        ShortLeaveStartTime = r.ShortLeaveStartTime,
        ShortLeaveEndTime = r.ShortLeaveEndTime,
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
        MedicalCertificateUrl = r.MedicalCertificateUrl,
    };

    private async Task SetResponsibleFieldsAsync(LeaveRequestDto dto, LeaveRequest r)
    {
        dto.ResponsibleEmployeeId = await GetResponsibleEmployeeIdAsync(r);
        dto.ResponsibleUserName = await GetResponsibleUserNameAsync(r);
    }

    private async Task<Guid?> GetResponsibleEmployeeIdAsync(LeaveRequest r)
    {
        if (r.Status == ApprovalStatus.Approved)
        {
            if (r.Level2ApproverId.HasValue) return r.Level2ApproverId;
            if (r.Level1ApproverId.HasValue) return r.Level1ApproverId;
            return r.ApproverId;
        }
        if (r.Status == ApprovalStatus.Rejected)
            return r.ApproverId;
        if (r.Status == ApprovalStatus.Pending)
            return await GetDirectSupervisorIdAsync(r.EmployeeId);
        if (r.Status == ApprovalStatus.CancellationRequested)
            return await GetDirectSupervisorIdAsync(r.EmployeeId);
        if (r.Status == ApprovalStatus.PendingLevel2 && r.Level1ApproverId.HasValue)
            return await GetDirectSupervisorIdAsync(r.Level1ApproverId.Value);
        return null;
    }

    private async Task<string?> GetResponsibleUserNameAsync(LeaveRequest r)
    {
        if (r.Status == ApprovalStatus.Approved)
            return r.Level2Approver != null ? r.Level2Approver.FirstName + " " + r.Level2Approver.LastName : r.Level1Approver != null ? r.Level1Approver.FirstName + " " + r.Level1Approver.LastName : r.Approver != null ? r.Approver.FirstName + " " + r.Approver.LastName : null;
        if (r.Status == ApprovalStatus.Rejected)
            return r.Approver != null ? r.Approver.FirstName + " " + r.Approver.LastName : null;
        if (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2 || r.Status == ApprovalStatus.CancellationRequested)
        {
            var supervisorId = await GetResponsibleEmployeeIdAsync(r);
            if (!supervisorId.HasValue) return null;
            var emp = await _db.Employees.FindAsync(supervisorId.Value);
            return emp != null ? emp.FirstName + " " + emp.LastName : null;
        }
        return null;
    }

    // ───── Leave Types ─────

    public async Task<List<LeaveTypeDto>> GetLeaveTypesAsync()
    {
        var items = await _db.Set<LeaveType>()
            .Select(t => new LeaveTypeDto
            {
                Id = t.Id,
                Name = t.Name,
                Code = t.Code,
                Description = t.Description,
                DefaultDaysPerYear = t.DefaultDaysPerYear,
                IsPaid = t.IsPaid,
                IsActive = t.IsActive,
                AllowHalfDay = t.AllowHalfDay,
                AllowShortLeave = t.AllowShortLeave,
                ShortLeaveHours = t.ShortLeaveHours,
                MinHours = t.MinHours,
                MaxHours = t.MaxHours,
                MinDays = t.MinDays,
                MaxDays = t.MaxDays,
            })
            .ToListAsync();

        return items
            .OrderBy(t => t.Code switch
            {
                "LT-ANN" => 1,
                "LT-CAS" => 2,
                "LT-SHL" => 3,
                "LT-SIC" => 4,
                "LT-MAT" => 5,
                "LT-NPL" => 6,
                _ => 99,
            })
            .ThenBy(t => t.Name)
            .ToList();
    }

    public async Task<LeaveTypeDto> CreateLeaveTypeAsync(CreateLeaveTypeDto dto)
    {
        var minDays = dto.MinDays;
        var maxDays = dto.MaxDays;
        LeaveDurationRules.NormalizeMinMax(ref minDays, ref maxDays);
        LeaveDurationRules.ResolveTypeDurationFlags(
            dto.Code, dto.AllowHalfDay, dto.ShortLeaveHours,
            out var allowHalfDay, out var allowShortLeave, out var shortLeaveHours);
        decimal? minHours = null;
        decimal? maxHours = null;
        if (allowShortLeave)
        {
            minDays = null;
            maxDays = null;
            minHours = dto.MinHours;
            maxHours = dto.MaxHours;
            LeaveDurationRules.NormalizeMinMaxHours(ref minHours, ref maxHours);
            shortLeaveHours = LeaveDurationRules.ClampHoursWithinBounds(shortLeaveHours, minHours, maxHours);
        }
        var entity = new LeaveType
        {
            Name = dto.Name, Code = dto.Code, Description = dto.Description,
            DefaultDaysPerYear = dto.DefaultDaysPerYear, IsPaid = dto.IsPaid, IsActive = dto.IsActive,
            AllowHalfDay = allowHalfDay, AllowShortLeave = allowShortLeave,
            ShortLeaveHours = shortLeaveHours,
            MinHours = minHours,
            MaxHours = maxHours,
            MinDays = minDays,
            MaxDays = maxDays,
        };
        _db.Set<LeaveType>().Add(entity);
        await _db.SaveChangesAsync();
        return MapLeaveType(entity);
    }

    public async Task<LeaveTypeDto?> UpdateLeaveTypeAsync(Guid id, UpdateLeaveTypeDto dto)
    {
        var entity = await _db.Set<LeaveType>().FindAsync(id);
        if (entity is null) return null;
        var minDays = dto.MinDays;
        var maxDays = dto.MaxDays;
        LeaveDurationRules.NormalizeMinMax(ref minDays, ref maxDays);
        entity.Name = dto.Name; entity.Code = dto.Code; entity.Description = dto.Description;
        entity.DefaultDaysPerYear = dto.DefaultDaysPerYear; entity.IsPaid = dto.IsPaid; entity.IsActive = dto.IsActive;
        LeaveDurationRules.ResolveTypeDurationFlags(
            dto.Code, dto.AllowHalfDay, dto.ShortLeaveHours,
            out var allowHalfDay, out var allowShortLeave, out var shortLeaveHours);
        decimal? minHours = null;
        decimal? maxHours = null;
        if (allowShortLeave)
        {
            minDays = null;
            maxDays = null;
            minHours = dto.MinHours;
            maxHours = dto.MaxHours;
            LeaveDurationRules.NormalizeMinMaxHours(ref minHours, ref maxHours);
            shortLeaveHours = LeaveDurationRules.ClampHoursWithinBounds(shortLeaveHours, minHours, maxHours);
        }
        entity.AllowHalfDay = allowHalfDay;
        entity.AllowShortLeave = allowShortLeave;
        entity.ShortLeaveHours = shortLeaveHours;
        entity.MinHours = minHours;
        entity.MaxHours = maxHours;
        entity.MinDays = minDays;
        entity.MaxDays = maxDays;
        await _db.SaveChangesAsync();
        return MapLeaveType(entity);
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

    private static LeaveBalanceDto MapLeaveBalanceToDto(LeaveBalance b, int carryAvailabilityMonths, DateTime asOfDate)
    {
        var leaveTypeName = b.LeaveType?.Name ?? "";
        var entitled = b.Entitled;
        var used = b.Used;
        var cf = b.CarriedForward;
        var isGrant = LeaveBalanceImportRules.IsNonExpiringGrantType(leaveTypeName, b.LeaveType?.Code);

        if (isGrant && entitled <= 0)
        {
            entitled = Math.Max(cf, Math.Max(0, b.BroughtForwardDays));
            cf = 0;
        }

        if (LeaveBalanceImportRules.LooksLikeClosingRemaining(entitled, used, cf))
            cf = 0;

        var importedOpening = b.IsImported || b.BroughtForwardDays > 0 || b.CarriedForward > 0 || b.Used > 0;
        if (!isGrant && !importedOpening && cf > 0 && IsCarryForwardWindowClosedAsOf(b, carryAvailabilityMonths, asOfDate))
            cf = Math.Min(cf, Math.Max(0, used - entitled));

        var opening = Math.Max(b.BroughtForwardDays, b.CarriedForward);
        return new LeaveBalanceDto
        {
            Id = b.Id,
            LeaveTypeId = b.LeaveTypeId,
            LeaveTypeName = leaveTypeName,
            Year = b.Year,
            PeriodStart = b.PeriodStart,
            PeriodEnd = b.PeriodEnd,
            PeriodLabel = GetPeriodLabel(b),
            Entitled = entitled,
            Used = used,
            CarriedForward = cf,
            BroughtForwardDays = Math.Max(opening, entitled),
            Remaining = entitled + cf - used,
        };
    }

    private static bool EnsureBroughtForwardOpeningRecorded(LeaveBalance b)
    {
        if (b.CarriedForward <= 0 || b.BroughtForwardDays >= b.CarriedForward)
            return false;
        b.BroughtForwardDays = b.CarriedForward;
        return true;
    }

    private static bool PeriodOverlaps(DateTime startA, DateTime endA, DateTime startB, DateTime endB)
        => startA <= endB && startB <= endA;

    public async Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year, DateTime? asOfDate = null)
    {
        var yearStart = new DateTime(year, 1, 1);
        var yearEnd = new DateTime(year, 12, 31);
        var list = await QueryEmployeeBalancesForYearAsync(employeeId, yearStart, yearEnd);

        if (list.Count == 0 && await _db.Employees.AnyAsync(e => e.Id == employeeId && !e.IsDeleted))
        {
            var hasRules = await _db.LeaveEntitlementRules.AnyAsync(r => r.IsActive && !r.IsDeleted);
            if (hasRules)
            {
                try
                {
                    await _entitlementService.CalculateAndApplyAsync(employeeId, year);
                    list = await QueryEmployeeBalancesForYearAsync(employeeId, yearStart, yearEnd);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Auto leave balance calculation failed for employee {EmployeeId}, year {Year}", employeeId, year);
                }
            }
        }

        var av = await GetCarryForwardAvailabilityMonthsAsync();
        var asOf = (asOfDate ?? _clock.Now).Date;
        await ForfeitExpiredCarryOnTrackedBalancesAsync(list, asOf, av);
        return CollapseBalanceDtos(list.Select(b => MapLeaveBalanceToDto(b, av, asOf)));
    }

    private async Task<List<LeaveBalance>> QueryEmployeeBalancesForYearAsync(Guid employeeId, DateTime yearStart, DateTime yearEnd)
    {
        var year = yearStart.Year;
        return await _db.Set<LeaveBalance>()
            .Include(b => b.LeaveType)
            .Where(b => b.EmployeeId == employeeId && (
                (b.PeriodStart == null && b.Year == year) ||
                (b.PeriodStart != null && b.PeriodEnd != null && b.PeriodStart <= yearEnd && b.PeriodEnd >= yearStart)))
            .ToListAsync();
    }

    public async Task<List<LeaveBalanceSummaryDto>> GetBalanceSummaryAsync(int year, DateTime? asOfDate = null)
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

        var av = await GetCarryForwardAvailabilityMonthsAsync();
        var asOf = (asOfDate ?? _clock.Now).Date;
        await ForfeitExpiredCarryOnTrackedBalancesAsync(balances, asOf, av);

        var importedEmployeeIds = balances
            .Where(IsImportedLeaveBalanceRow)
            .Select(b => b.EmployeeId)
            .ToHashSet();

        return employees
            .Where(e => importedEmployeeIds.Count == 0 || importedEmployeeIds.Contains(e.Id))
            .Select(e => new LeaveBalanceSummaryDto
            {
                EmployeeId = e.Id,
                EmployeeName = $"{e.FirstName} {e.LastName}",
                EmployeeCode = e.EmployeeCode,
                Balances = CollapseBalanceDtos(
                    balances.Where(b => b.EmployeeId == e.Id).Select(b => MapLeaveBalanceToDto(b, av, asOf))),
            })
            .Where(s => s.Balances.Count > 0)
            .OrderBy(s => s.EmployeeName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool IsImportedLeaveBalanceRow(LeaveBalance b)
        => b.IsImported
            || b.Entitled != 0
            || b.Used != 0
            || b.CarriedForward != 0
            || b.BroughtForwardDays != 0
            || (LeaveBalanceImportRules.IsNonExpiringGrantType(b.LeaveType?.Name, b.LeaveType?.Code));

    private static List<LeaveBalanceDto> CollapseBalanceDtos(IEnumerable<LeaveBalanceDto> rows)
        => LeaveBalanceImportRules.CollapseDuplicateLeaveTypeRows(
            rows,
            b => b.LeaveTypeId,
            b => b.Entitled,
            b => b.Used,
            b => b.CarriedForward,
            b => b.Remaining);

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
            BroughtForwardDays = dto.CarriedForward,
        };
        _db.Set<LeaveBalance>().Add(balance);
        await _db.SaveChangesAsync();

        var created = await _db.Set<LeaveBalance>().Include(b => b.LeaveType).FirstAsync(b => b.Id == balance.Id);
        var av = await GetCarryForwardAvailabilityMonthsAsync();
        return MapLeaveBalanceToDto(created, av, _clock.Now.Date);
    }

    public async Task<LeaveBalanceDto?> UpdateLeaveBalanceAsync(Guid id, UpdateLeaveBalanceDto dto)
    {
        var balance = await _db.Set<LeaveBalance>().Include(b => b.LeaveType).FirstOrDefaultAsync(b => b.Id == id);
        if (balance is null) return null;
        var isGrant = LeaveBalanceImportRules.IsNonExpiringGrantType(balance.LeaveType?.Name, balance.LeaveType?.Code);
        var mapped = LeaveBalanceImportRules.MapImportedStock(
            dto.Entitled, dto.CarriedForward, leaveTypeHasEntitlementRule: !isGrant, isGrant, dto.Used);
        balance.Entitled = mapped.Entitled;
        balance.Used = dto.Used;
        balance.CarriedForward = mapped.CarriedForward;
        balance.BroughtForwardDays = Math.Max(balance.BroughtForwardDays, mapped.CarriedForward);
        await _db.SaveChangesAsync();
        var av = await GetCarryForwardAvailabilityMonthsAsync();
        return MapLeaveBalanceToDto(balance, av, _clock.Now.Date);
    }

    /// <summary>
    /// Processes leave carry forward from one year to the next. Run at the beginning of a new year.
    /// Carry cap: leave policy (allow carry) when set; else leave type default days/year; else all remaining (so balances without policies still move forward).
    /// </summary>
    public async Task<CarryForwardResult> ProcessCarryForwardAsync(int fromYear, int toYear, IReadOnlySet<Guid>? onlyEmployeeIds = null)
    {
        if (toYear != fromYear + 1)
            throw new InvalidOperationException("Carry forward is only allowed from one year to the next (e.g. 2025 → 2026).");

        if (onlyEmployeeIds is not null && onlyEmployeeIds.Count == 0)
            return new CarryForwardResult { FromYear = fromYear, ToYear = toYear, BalancesProcessed = 0, BalancesUpdated = 0, BalancesCreated = 0, TotalDaysCarried = 0, InfoMessage = "No employees selected for carry forward." };

        // Per–leave-type cap from policy (when configured).
        var policyRows = await _db.Set<LeavePolicy>()
            .Where(p => !p.IsDeleted && p.AllowCarryForward)
            .ToListAsync();

        var policyByLeaveType = new Dictionary<Guid, int>();
        foreach (var g in policyRows.GroupBy(p => p.LeaveTypeId))
        {
            var p = g.OrderByDescending(x => x.MaxCarryForwardDays).First();
            var cap = p.MaxCarryForwardDays > 0 ? p.MaxCarryForwardDays : p.MaxDaysPerYear;
            if (cap > 0)
                policyByLeaveType[p.LeaveTypeId] = cap;
        }

        // Same year resolution as GetBalanceSummaryAsync / GetEmployeeBalancesAsync: calendar year overlap, not b.Year == fromYear only.
        // Include all active leave types (not only those with a carry policy) so carry works for balances that have no policy row yet.
        var fromYearStart = new DateTime(fromYear, 1, 1);
        var fromYearEnd = new DateTime(fromYear, 12, 31);
        var fromBalances = await _db.Set<LeaveBalance>()
            .Include(b => b.LeaveType)
            .Where(b => !b.IsDeleted
                && b.LeaveType != null
                && !b.LeaveType.IsDeleted
                && ((b.PeriodStart == null && b.Year == fromYear) ||
                    (b.PeriodStart != null && b.PeriodEnd != null && b.PeriodStart <= fromYearEnd && b.PeriodEnd >= fromYearStart)))
            .ToListAsync();

        if (onlyEmployeeIds is not null)
            fromBalances = fromBalances.Where(b => onlyEmployeeIds.Contains(b.EmployeeId)).ToList();

        int created = 0, updated = 0;
        decimal totalCarried = 0;
        var anyUsedOpenRemainingCap = false;

        var toYearStart = new DateTime(toYear, 1, 1);
        var toYearEnd = new DateTime(toYear, 12, 31);

        foreach (var fromBal in fromBalances)
        {
            var maxCarry = GetMaxCarryableDays(fromBal, policyByLeaveType, out var usedOpenRemaining);
            if (usedOpenRemaining) anyUsedOpenRemainingCap = true;

            var remaining = LeaveBalanceImportRules.ComputeRemaining(fromBal.Entitled, fromBal.Used, fromBal.CarriedForward);
            if (remaining <= 0) continue;

            var carryDays = Math.Min(remaining, maxCarry);
            if (carryDays <= 0) continue;

            var toBalance = await _db.Set<LeaveBalance>()
                .Where(b => b.EmployeeId == fromBal.EmployeeId
                    && b.LeaveTypeId == fromBal.LeaveTypeId
                    && !b.IsDeleted
                    && ((b.PeriodStart == null && b.Year == toYear)
                        || (b.PeriodStart != null && b.PeriodEnd != null && b.PeriodStart <= toYearEnd && b.PeriodEnd >= toYearStart)))
                .OrderBy(b => b.Year)
                .ThenBy(b => b.Id)
                .FirstOrDefaultAsync();

            if (toBalance != null)
            {
                toBalance.CarriedForward = carryDays;
                toBalance.BroughtForwardDays = carryDays;
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
                    BroughtForwardDays = carryDays,
                });
                created++;
            }
            totalCarried += carryDays;
        }

        await _db.SaveChangesAsync();

        string? info = null;
        if (fromBalances.Count == 0)
            info = "No source-year leave balances were found for the selected year and employees. Add leave balances (Leave Balances / assign) for the source year first.";
        else if (totalCarried == 0)
            info = "Source rows were found, but every one had 0 days remaining (nothing unused to move).";
        if (anyUsedOpenRemainingCap && totalCarried > 0)
            info = (string.IsNullOrEmpty(info) ? "" : info + " ") + "Some amounts used the full remaining balance (no carry policy and leave type default days is 0). Add a policy with 'Allow carry forward' to set explicit caps per leave type.";

        return new CarryForwardResult
        {
            FromYear = fromYear,
            ToYear = toYear,
            BalancesProcessed = fromBalances.Count,
            BalancesUpdated = updated,
            BalancesCreated = created,
            TotalDaysCarried = totalCarried,
            InfoMessage = string.IsNullOrWhiteSpace(info) ? null : info.Trim(),
        };
    }

    /// <summary>Max days that may move in one run: policy cap, else leave type default per year, else all remaining (no artificial cap).</summary>
    private static decimal GetMaxCarryableDays(LeaveBalance fromBal, IReadOnlyDictionary<Guid, int> policyByLeaveType, out bool usedOpenRemainingCap)
    {
        usedOpenRemainingCap = false;
        if (policyByLeaveType.TryGetValue(fromBal.LeaveTypeId, out var pcap) && pcap > 0)
            return pcap;
        var d = fromBal.LeaveType?.DefaultDaysPerYear ?? 0;
        if (d > 0) return d;
        usedOpenRemainingCap = true;
        return 9999m;
    }

    public async Task<CarryForwardAvailabilitySettingsDto> GetCarryForwardAvailabilitySettingsAsync()
    {
        var months = await GetCarryForwardAvailabilityMonthsAsync();
        var desc = months >= 12
            ? "Carry-forward days may be used for the full 12 months of the balance period."
            : "Carried-from days on a balance may only be used for leave with a start date in the first " + months
              + " month(s) of that balance period (for a full calendar year, from 1 January). "
              + "After that window, new requests are limited to standard entitlement (excluding the carried amount).";
        var (intro, points) = await GetCarryForwardNarrativeDisplayAsync();
        return new CarryForwardAvailabilitySettingsDto
        {
            AvailabilityMonths = months,
            WindowDescription = desc,
            NarrativeIntro = intro,
            NarrativePoints = points,
        };
    }

    public async Task<CarryForwardAvailabilitySettingsDto> SetCarryForwardAvailabilitySettingsAsync(UpdateCarryForwardAvailabilitySettingsDto dto)
    {
        var m = Math.Clamp(dto.AvailabilityMonths, 1, 12);
        await _systemSettings.SetAsync(CarryForwardAvailabilityMonthsKey, m.ToString());
        if (dto.NarrativeIntro is not null || dto.NarrativePoints is not null)
        {
            var (defIntro, defPointArr) = GetDefaultCarryForwardNarrative();
            var (curIntro, curPl) = await GetCarryForwardNarrativeDisplayAsync();
            var intro = dto.NarrativeIntro is not null
                ? (string.IsNullOrWhiteSpace(dto.NarrativeIntro) ? defIntro : dto.NarrativeIntro.Trim())
                : curIntro;
            var outPoints = new List<string>(3);
            for (var i = 0; i < 3; i++)
            {
                if (dto.NarrativePoints is not null && i < dto.NarrativePoints.Length)
                {
                    var s = (dto.NarrativePoints[i] ?? "").Trim();
                    outPoints.Add(string.IsNullOrEmpty(s) ? defPointArr[i] : s);
                }
                else
                {
                    outPoints.Add(curPl[i]);
                }
            }
            var payload = JsonSerializer.Serialize(
                new CarryNarrativeStored { Intro = intro, Points = outPoints },
                CarryNarrativeJsonOptions);
            await _systemSettings.SetAsync(CarryForwardNarrativeKey, payload);
        }
        return await GetCarryForwardAvailabilitySettingsAsync();
    }

    private static readonly JsonSerializerOptions CarryNarrativeJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static (string intro, string[] points) GetDefaultCarryForwardNarrative() =>
    (
        "Not a separate leave type — unused days from a completed balance year can be moved into the next year for leave types that your policy allows (for example annual leave), up to the limits you set.",
        new[]
        {
            "In Leave → Policies, enable Allow carry forward and set Max carry forward days (and max days per year) for that leave type.",
            "At the start of a new year, use Leave → Carry Forward to run the process: remaining days (within policy limits) are written to the new year as carried forward on the balance.",
            "Carried days are then used with the same balance, subject to that leave type’s policy and approval rules.",
        }
    );

    private async Task<(string intro, List<string> points)> GetCarryForwardNarrativeDisplayAsync()
    {
        var (defIntro, defArr) = GetDefaultCarryForwardNarrative();
        var defPoints = defArr.ToList();
        var raw = await _systemSettings.GetAsync(CarryForwardNarrativeKey);
        if (string.IsNullOrWhiteSpace(raw))
            return (defIntro, defPoints);
        try
        {
            var s = JsonSerializer.Deserialize<CarryNarrativeStored>(raw, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                ReadCommentHandling = JsonCommentHandling.Disallow,
            });
            if (s is null)
                return (defIntro, defPoints);
            var intro = string.IsNullOrWhiteSpace(s.Intro) ? defIntro : s.Intro;
            var pts = new List<string>(3);
            for (var i = 0; i < 3; i++)
            {
                if (s.Points != null && i < s.Points.Count && !string.IsNullOrWhiteSpace(s.Points[i]))
                    pts.Add(s.Points[i]!);
                else
                    pts.Add(defPoints[i]);
            }
            return (intro, pts);
        }
        catch
        {
            return (defIntro, defPoints);
        }
    }

    private sealed class CarryNarrativeStored
    {
        public string? Intro { get; set; }
        public List<string>? Points { get; set; }
    }

    private async Task<int> GetCarryForwardAvailabilityMonthsAsync()
    {
        var raw = await _systemSettings.GetAsync(CarryForwardAvailabilityMonthsKey);
        if (string.IsNullOrWhiteSpace(raw) || !int.TryParse(raw, out var m) || m < 1) m = 3;
        return Math.Clamp(m, 1, 12);
    }

    /// <summary>Last day (inclusive) of the “use carried-forward” window for this balance, using the first N months from the period (or year) start.</summary>
    private static DateTime GetCarryForwardWindowEndInclusive(LeaveBalance balance, int months)
    {
        var start = balance.PeriodStart.HasValue
            ? balance.PeriodStart.Value.Date
            : new DateTime(balance.Year, 1, 1);
        var end = start.AddMonths(months).AddDays(-1);
        if (balance.PeriodEnd.HasValue)
        {
            var cap = balance.PeriodEnd.Value.Date;
            if (end > cap) end = cap;
        }
        return end;
    }

    private static bool IsCarryForwardWindowClosedAsOf(LeaveBalance balance, int months, DateTime asOfDate)
    {
        var end = GetCarryForwardWindowEndInclusive(balance, months);
        return asOfDate.Date > end.Date;
    }

    /// <summary>
    /// When the use window has passed, any carried-forward days that were not used (could not be attributed
    /// to <see cref="LeaveBalance.Used"/> in excess of <see cref="LeaveBalance.Entitled"/>) are removed.
    /// Remaining "carry" stored on the line reflects only the part that explains use above entitlement, so totals stay non-negative.
    /// </summary>
    private static bool TryForfeitCarryAfterWindowEnded(LeaveBalance b, int avMonths, DateTime asOfDate, out decimal previousCarriedForward)
    {
        previousCarriedForward = b.CarriedForward;
        if (b.CarriedForward <= 0) return false;
        if (LeaveBalanceImportRules.IsNonExpiringGrantType(b.LeaveType?.Name, b.LeaveType?.Code))
            return false;
        if (!IsCarryForwardWindowClosedAsOf(b, avMonths, asOfDate)) return false;
        var newCf = Math.Min(b.CarriedForward, Math.Max(0, b.Used - b.Entitled));
        if (newCf == b.CarriedForward) return false;
        b.CarriedForward = newCf;
        return true;
    }

    private async Task ForfeitExpiredCarryOnTrackedBalancesAsync(List<LeaveBalance> balances, DateTime asOfDate, int carryAvailabilityMonths)
    {
        // Record opening CF, but do not persist 3-month forfeiture on read.
        // Persisting against the selected as-of month wiped imported grant stock and made January carry irreversible.
        var any = false;
        foreach (var b in balances)
        {
            if (EnsureBroughtForwardOpeningRecorded(b))
                any = true;
            if (LeaveBalanceImportRules.LooksLikeClosingRemaining(b.Entitled, b.Used, b.CarriedForward))
            {
                b.CarriedForward = 0;
                any = true;
            }
        }
        if (any)
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Saved carry-forward opening days for at least one balance in this batch.");
        }
    }

    private static bool IsInCarryForwardUseWindow(DateTime requestStart, LeaveBalance balance, int months)
    {
        if (months >= 12) return true;
        var end = GetCarryForwardWindowEndInclusive(balance, months);
        var start = balance.PeriodStart.HasValue
            ? balance.PeriodStart.Value.Date
            : new DateTime(balance.Year, 1, 1);
        return requestStart.Date >= start && requestStart.Date <= end;
    }

    private static string GetCarryForwardWindowEndDisplay(LeaveBalance balance, int months)
        => GetCarryForwardWindowEndInclusive(balance, months).ToString("d MMM yyyy");

    // ───── Holidays ─────

    public async Task<HolidayLocaleSettingsDto> GetHolidayLocaleSettingsAsync()
    {
        var country = await ResolveHolidayCountryCodeAsync(null);
        var timeZone = await ResolveHolidayTimeZoneIdAsync(null);
        return BuildHolidayLocaleSettingsDto(country, timeZone);
    }

    public async Task<HolidayLocaleSettingsDto> SetHolidayLocaleSettingsAsync(UpdateHolidayLocaleSettingsDto dto)
    {
        var country = HolidayCountryCodes.Normalize(dto.CountryCode);
        var timeZone = NormalizeHolidayTimeZoneId(dto.TimeZoneId);
        await _systemSettings.SetAsync(HolidayLocaleCatalog.CountrySettingKey, country);
        await _systemSettings.SetAsync(HolidayLocaleCatalog.TimeZoneSettingKey, timeZone);

        foreach (var year in new[] { 2024, 2025, 2026, 2027 })
            await LeaveSeeder.EnsureCountryHolidaysForYearAsync(_db, year, country);

        return BuildHolidayLocaleSettingsDto(country, timeZone);
    }

    public async Task<List<HolidayDto>> GetHolidaysAsync(int year, string? countryCode = null)
    {
        var country = await ResolveHolidayCountryCodeAsync(countryCode);
        await LeaveSeeder.EnsureCountryHolidaysForYearAsync(_db, year, country);

        return await _db.Set<Holiday>()
            .Where(h => h.Year == year && h.CountryCode == country)
            .OrderBy(h => h.Date)
            .Select(h => new HolidayDto
            {
                Id = h.Id,
                Name = h.Name,
                Date = h.Date,
                Kind = h.Kind,
                IsRestricted = h.IsRestricted,
                Description = h.Description,
                Year = h.Year,
                CountryCode = h.CountryCode,
            })
            .ToListAsync();
    }

    public async Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto)
    {
        var kind = HolidayKinds.Normalize(dto.Kind, dto.IsRestricted);
        var country = await ResolveHolidayCountryCodeAsync(null);
        var holiday = new Holiday
        {
            Name = dto.Name,
            Date = dto.Date,
            Kind = kind,
            IsRestricted = kind == HolidayKinds.Restricted,
            Description = dto.Description,
            Year = dto.Year,
            CountryCode = country,
        };
        _db.Set<Holiday>().Add(holiday);
        await _db.SaveChangesAsync();
        return MapHolidayDto(holiday);
    }

    public async Task<HolidayDto?> UpdateHolidayAsync(Guid id, UpdateHolidayDto dto)
    {
        var entity = await _db.Set<Holiday>().FindAsync(id);
        if (entity is null) return null;
        var kind = HolidayKinds.Normalize(dto.Kind, dto.IsRestricted);
        entity.Name = dto.Name;
        entity.Date = dto.Date;
        entity.Kind = kind;
        entity.IsRestricted = kind == HolidayKinds.Restricted;
        entity.Description = dto.Description;
        entity.Year = dto.Year;
        await _db.SaveChangesAsync();
        return MapHolidayDto(entity);
    }

    private static HolidayDto MapHolidayDto(Holiday holiday) =>
        new()
        {
            Id = holiday.Id,
            Name = holiday.Name,
            Date = holiday.Date,
            Kind = HolidayKinds.Normalize(holiday.Kind, holiday.IsRestricted),
            IsRestricted = holiday.IsRestricted,
            Description = holiday.Description,
            Year = holiday.Year,
            CountryCode = holiday.CountryCode,
        };

    private async Task<string> ResolveHolidayCountryCodeAsync(string? countryCode)
    {
        if (!string.IsNullOrWhiteSpace(countryCode))
            return HolidayCountryCodes.Normalize(countryCode);
        var stored = await _systemSettings.GetAsync(HolidayLocaleCatalog.CountrySettingKey);
        return HolidayCountryCodes.Normalize(stored ?? HolidayLocaleCatalog.DefaultCountryCode);
    }

    private async Task<string> ResolveHolidayTimeZoneIdAsync(string? timeZoneId)
    {
        if (!string.IsNullOrWhiteSpace(timeZoneId))
            return NormalizeHolidayTimeZoneId(timeZoneId);
        var stored = await _systemSettings.GetAsync(HolidayLocaleCatalog.TimeZoneSettingKey);
        return NormalizeHolidayTimeZoneId(stored ?? HolidayLocaleCatalog.DefaultTimeZoneId);
    }

    private static string NormalizeHolidayTimeZoneId(string? timeZoneId)
    {
        if (string.IsNullOrWhiteSpace(timeZoneId))
            return HolidayLocaleCatalog.DefaultTimeZoneId;
        var match = HolidayLocaleCatalog.TimeZones.FirstOrDefault(t =>
            string.Equals(t.Id, timeZoneId.Trim(), StringComparison.OrdinalIgnoreCase));
        return match?.Id ?? HolidayLocaleCatalog.DefaultTimeZoneId;
    }

    private static HolidayLocaleSettingsDto BuildHolidayLocaleSettingsDto(string countryCode, string timeZoneId) =>
        new()
        {
            CountryCode = countryCode,
            TimeZoneId = timeZoneId,
            Countries = HolidayLocaleCatalog.Countries
                .Select(c => new HolidayLocaleOptionDto { Code = c.Code, Label = c.Label })
                .ToList(),
            TimeZones = HolidayLocaleCatalog.TimeZones
                .Select(t => new HolidayTimeZoneOptionDto { Id = t.Id, Label = t.Label, CountryCode = t.CountryCode })
                .ToList(),
        };

    public async Task<bool> DeleteHolidayAsync(Guid id)
    {
        var entity = await _db.Set<Holiday>().FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ───── Calendar ─────

    public async Task<List<CalendarDayDto>> GetCalendarAsync(int month, int year, Guid? departmentId = null)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

        var query = _db.Set<LeaveRequest>()
            .Include(r => r.Employee).Include(r => r.LeaveType)
            .Where(r => r.Status == ApprovalStatus.Approved && r.StartDate < end && r.EndDate >= start);

        if (departmentId.HasValue)
            query = query.Where(r => r.Employee.DepartmentId == departmentId.Value);

        var requests = await query.ToListAsync();

        var days = new Dictionary<DateTime, CalendarDayDto>();
        foreach (var r in requests)
        {
            if (r.Employee is null || r.LeaveType is null)
                continue;
            for (var d = r.StartDate.Date; d <= r.EndDate.Date; d = d.AddDays(1))
            {
                if (d.Month != month || d.Year != year) continue;
                var key = d.Date;
                if (!days.ContainsKey(key))
                    days[key] = new CalendarDayDto { Date = key };
                days[key].Entries.Add(new CalendarEntryDto
                {
                    EmployeeName = $"{r.Employee.FirstName} {r.Employee.LastName}",
                    ProfileImageUrl = r.Employee.ProfileImageUrl,
                    LeaveTypeName = r.LeaveType.Name,
                    Status = r.Status.ToString(),
                });
            }
        }

        return days.Values.OrderBy(d => d.Date).ToList();
    }
}
