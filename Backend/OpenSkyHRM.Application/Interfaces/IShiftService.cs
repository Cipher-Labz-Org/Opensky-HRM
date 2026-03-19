using OpenSkyHRM.Application.DTOs.TimeAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IShiftService
{
    Task<List<ShiftPatternDto>> GetAllAsync(bool includeInactive = false);
    Task<ShiftPatternDto?> GetByIdAsync(Guid id);
    Task<ShiftPatternDto> CreateAsync(CreateShiftPatternDto dto);
    Task<ShiftPatternDto?> UpdateAsync(Guid id, UpdateShiftPatternDto dto);
    Task<bool> DeleteAsync(Guid id);
}
