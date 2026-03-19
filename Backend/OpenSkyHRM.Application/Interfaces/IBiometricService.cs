using OpenSkyHRM.Application.DTOs.TimeAttendance;

namespace OpenSkyHRM.Application.Interfaces;

public interface IBiometricService
{
    Task<List<BiometricDeviceDto>> GetAllDevicesAsync();
    Task<BiometricDeviceDto?> GetDeviceByIdAsync(Guid id);
    Task<BiometricDeviceDto> CreateDeviceAsync(CreateBiometricDeviceDto dto);
    Task<BiometricDeviceDto?> UpdateDeviceAsync(Guid id, UpdateBiometricDeviceDto dto);
    Task<bool> DeleteDeviceAsync(Guid id);
    Task<PunchImportBatchDto> ImportPunchesAsync(Guid deviceId, string fileName, List<PunchImportRowDto> rows);
    Task<List<PunchImportBatchDto>> GetImportHistoryAsync(Guid? deviceId = null);
}
