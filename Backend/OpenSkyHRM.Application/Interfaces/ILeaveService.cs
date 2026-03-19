using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILeaveService
{
    // Dashboard
    Task<LeaveDashboardDto> GetDashboardAsync();

    // Leave Requests
    Task<PagedResult<LeaveRequestDto>> GetLeaveRequestsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? employeeId = null, DateTime? fromDate = null, DateTime? toDate = null, IReadOnlyList<Guid>? allowedEmployeeIds = null, Guid? excludeEmployeeId = null);
    Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto);
    Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);
    Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);

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
    Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year);
    Task<List<LeaveBalanceSummaryDto>> GetBalanceSummaryAsync(int year);
    Task<LeaveBalanceDto> CreateLeaveBalanceAsync(CreateLeaveBalanceDto dto);
    Task<LeaveBalanceDto?> UpdateLeaveBalanceAsync(Guid id, UpdateLeaveBalanceDto dto);
    Task<CarryForwardResult> ProcessCarryForwardAsync(int fromYear, int toYear);

    // Holidays
    Task<List<HolidayDto>> GetHolidaysAsync(int year);
    Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto);
    Task<HolidayDto?> UpdateHolidayAsync(Guid id, UpdateHolidayDto dto);
    Task<bool> DeleteHolidayAsync(Guid id);

    // Calendar
    Task<List<CalendarDayDto>> GetCalendarAsync(int month, int year);
}
