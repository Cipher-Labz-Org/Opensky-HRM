using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAttendanceService
{
    Task<PagedResult<AttendanceRecordDto>> GetAttendanceAsync(
        int page = 1, int pageSize = 20, Guid? employeeId = null, DateTime? fromDate = null, DateTime? toDate = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        Guid? departmentId = null, Guid? locationId = null, string? status = null, string? source = null,
        string? sortBy = null, string? sortDir = null);
    Task<AttendanceSummaryDto> GetSummaryAsync(DateTime from, DateTime to, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<IReadOnlyList<AttendanceDailySummaryDto>> GetDailySummariesAsync(DateTime from, DateTime to, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<AttendanceRecordDto> CreateAsync(CreateAttendanceRecordDto dto);
    Task<AttendanceRecordDto?> UpdateAsync(Guid id, UpdateAttendanceRecordDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<AttendanceRecordDto> PunchAsync(Guid employeeId, PunchRequestDto dto);
    Task<List<OvertimeNopayResultDto>> CalculateOvertimeNopayAsync(
        DateTime from, DateTime to, Guid? employeeId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        IReadOnlyList<Guid>? includeEmployeeIds = null,
        Guid? actingEmployeeId = null,
        bool hrCanOverride = false);
    Task<List<OvertimeNopayDayDto>> GetOvertimeNopayDaysAsync(
        DateTime from, DateTime to, Guid? employeeId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<OvertimeNopayResultDto?> SetOvertimeNopayPeriodApprovalAsync(
        DateTime from, DateTime to, Guid employeeId, Guid? approverEmployeeId, bool approve, string? remarks,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        bool hrCanOverride = false);
}
