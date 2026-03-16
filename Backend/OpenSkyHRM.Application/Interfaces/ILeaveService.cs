using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface ILeaveService
{
    Task<PagedResult<LeaveRequestDto>> GetLeaveRequestsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? employeeId = null);
    Task<LeaveRequestDto> CreateLeaveRequestAsync(CreateLeaveRequestDto dto);
    Task<LeaveRequestDto?> ApproveLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);
    Task<LeaveRequestDto?> RejectLeaveRequestAsync(Guid id, Guid approverId, ApproveRejectLeaveDto dto);
    Task<List<LeaveTypeDto>> GetLeaveTypesAsync();
    Task<List<LeaveBalanceDto>> GetEmployeeBalancesAsync(Guid employeeId, int year);
    Task<List<HolidayDto>> GetHolidaysAsync(int year);
    Task<HolidayDto> CreateHolidayAsync(CreateHolidayDto dto);
}
