using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAttendanceService
{
    Task<PagedResult<AttendanceRecordDto>> GetAttendanceAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, DateTime? date = null);
    Task<AttendanceSummaryDto> GetSummaryAsync(DateTime from, DateTime to, Guid? employeeId = null);
    Task<AttendanceRecordDto> CreateAsync(CreateAttendanceRecordDto dto);
}
