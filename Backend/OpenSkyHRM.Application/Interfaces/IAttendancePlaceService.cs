using OpenSkyHRM.Application.DTOs.LeaveAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAttendancePlaceService
{
    Task<List<AttendancePlaceDto>> GetAllAsync();
    Task<AttendancePlaceDto?> GetByIdAsync(Guid id);
    Task<AttendancePlaceDto> CreateAsync(CreateAttendancePlaceDto dto);
    Task<AttendancePlaceDto?> UpdateAsync(Guid id, UpdateAttendancePlaceDto dto);
    Task<bool> DeleteAsync(Guid id);
}
