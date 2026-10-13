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
    Task<AdmsProcessResultDto> ProcessAdmsPunchesToAttendanceAsync(CancellationToken cancellationToken = default);
    Task<AdmsProcessResultDto> ProcessAllPendingAdmsPunchesAsync(int maxBatches = 50, CancellationToken cancellationToken = default);
    Task<int> ReconcileRecentBiometricAttendanceAsync(int days = 14, CancellationToken cancellationToken = default);
    Task<int> RepairStoredBiometricHoursAsync(CancellationToken cancellationToken = default);
    Task<BiometricDayRebuildResult> RebuildEmployeeDaysAsync(Guid employeeId, IReadOnlyCollection<DateTime> days, CancellationToken cancellationToken = default);
    Task<AdmsPipelineStatusDto> GetAdmsPipelineStatusAsync(string? recommendedWebhookUrl = null, CancellationToken cancellationToken = default);
}
