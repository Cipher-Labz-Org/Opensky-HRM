using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILeaveService
{
    // Dashboard
    Task<LeaveDashboardDto> GetDashboardAsync();

    // Leave Requests
    Task<PagedResult<LeaveRequestDto>> GetLeaveRequestsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? employeeId = null, DateTime? fromDate = null, DateTime? toDate = null, IReadOnlyList<Guid>? allowedEmployeeIds = null, Guid? excludeEmployeeId = null);
    Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto, string? medicalCertificateUrl = null);
    Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);
    /// <summary>Approves every request waiting for level 2; returns how many were approved.</summary>
    Task<int> FinalizePendingLevel2RequestsAsync();
    Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);
    Task<LeaveRequestDto> CancelLeaveRequestAsync(Guid id, Guid actingEmployeeId, string? remarks);
    Task<Guid?> GetResponsibleApproverEmployeeIdAsync(Guid leaveRequestId);

    // Leave Types
    Task<List<LeaveTypeDto>> GetLeaveTypesAsync();
    Task<LeaveTypeDto> CreateLeaveTypeAsync(CreateLeaveTypeDto dto);
    Task<LeaveTypeDto?> UpdateLeaveTypeAsync(Guid id, UpdateLeaveTypeDto dto);
    Task<bool> DeleteLeaveTypeAsync(Guid id);

    // Leave Policies
    Task<List<LeavePolicyDto>> GetLeavePoliciesAsync();
    Task<LeavePolicyDto> CreateLeavePolicyAsync(CreateLeavePolicyDto dto);
    Task<LeavePolicyDto?> UpdateLeavePolicyAsync(Guid id, UpdateLeavePolicyDto dto);
    Task<bool> DeleteLeavePolicyAsync(Guid id);

    // Leave Balances
    Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year, DateTime? asOfDate = null);
    Task<List<LeaveBalanceSummaryDto>> GetBalanceSummaryAsync(int year, DateTime? asOfDate = null);
    Task<LeaveBalanceDto> CreateLeaveBalanceAsync(CreateLeaveBalanceDto dto);
    Task<LeaveBalanceDto?> UpdateLeaveBalanceAsync(Guid id, UpdateLeaveBalanceDto dto);
    Task<CarryForwardResult> ProcessCarryForwardAsync(int fromYear, int toYear, IReadOnlySet<Guid>? onlyEmployeeIds = null);
    Task<CarryForwardAvailabilitySettingsDto> GetCarryForwardAvailabilitySettingsAsync();
    Task<CarryForwardAvailabilitySettingsDto> SetCarryForwardAvailabilitySettingsAsync(UpdateCarryForwardAvailabilitySettingsDto dto);

    // Holidays
    Task<HolidayLocaleSettingsDto> GetHolidayLocaleSettingsAsync();
    Task<HolidayLocaleSettingsDto> SetHolidayLocaleSettingsAsync(UpdateHolidayLocaleSettingsDto dto);
    Task<List<HolidayDto>> GetHolidaysAsync(int year, string? countryCode = null);
    Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto);
    Task<HolidayDto?> UpdateHolidayAsync(Guid id, UpdateHolidayDto dto);
    Task<bool> DeleteHolidayAsync(Guid id);

    // Calendar
    Task<List<CalendarDayDto>> GetCalendarAsync(int month, int year, Guid? departmentId = null);
}
