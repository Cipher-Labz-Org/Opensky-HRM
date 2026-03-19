using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class BiometricService : IBiometricService
{
    private readonly AppDbContext _db;

    public BiometricService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<BiometricDeviceDto>> GetAllDevicesAsync()
    {
        return await _db.BiometricDevices
            .OrderBy(d => d.Name)
            .Select(d => new BiometricDeviceDto
            {
                Id = d.Id,
                Name = d.Name,
                SerialNumber = d.SerialNumber,
                Location = d.Location,
                DeviceType = d.DeviceType,
                IsActive = d.IsActive,
                LastSyncAt = d.LastSyncAt,
            })
            .ToListAsync();
    }

    public async Task<BiometricDeviceDto?> GetDeviceByIdAsync(Guid id)
    {
        var d = await _db.BiometricDevices.FindAsync(id);
        if (d == null) return null;
        return new BiometricDeviceDto
        {
            Id = d.Id,
            Name = d.Name,
            SerialNumber = d.SerialNumber,
            Location = d.Location,
            DeviceType = d.DeviceType,
            IsActive = d.IsActive,
            LastSyncAt = d.LastSyncAt,
        };
    }

    public async Task<BiometricDeviceDto> CreateDeviceAsync(CreateBiometricDeviceDto dto)
    {
        var entity = new BiometricDevice
        {
            Name = dto.Name,
            SerialNumber = dto.SerialNumber,
            Location = dto.Location,
            DeviceType = dto.DeviceType,
            IsActive = dto.IsActive,
        };
        _db.BiometricDevices.Add(entity);
        await _db.SaveChangesAsync();
        return new BiometricDeviceDto
        {
            Id = entity.Id,
            Name = entity.Name,
            SerialNumber = entity.SerialNumber,
            Location = entity.Location,
            DeviceType = entity.DeviceType,
            IsActive = entity.IsActive,
            LastSyncAt = entity.LastSyncAt,
        };
    }

    public async Task<BiometricDeviceDto?> UpdateDeviceAsync(Guid id, UpdateBiometricDeviceDto dto)
    {
        var entity = await _db.BiometricDevices.FindAsync(id);
        if (entity == null) return null;

        entity.Name = dto.Name;
        entity.SerialNumber = dto.SerialNumber;
        entity.Location = dto.Location;
        entity.DeviceType = dto.DeviceType;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();

        return new BiometricDeviceDto
        {
            Id = entity.Id,
            Name = entity.Name,
            SerialNumber = entity.SerialNumber,
            Location = entity.Location,
            DeviceType = entity.DeviceType,
            IsActive = entity.IsActive,
            LastSyncAt = entity.LastSyncAt,
        };
    }

    public async Task<bool> DeleteDeviceAsync(Guid id)
    {
        var entity = await _db.BiometricDevices.FindAsync(id);
        if (entity == null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<PunchImportBatchDto> ImportPunchesAsync(Guid deviceId, string fileName, List<PunchImportRowDto> rows)
    {
        var device = await _db.BiometricDevices.FindAsync(deviceId);
        if (device == null)
            throw new ArgumentException("Device not found");

        var batch = new PunchImportBatch
        {
            DeviceId = deviceId,
            FileName = fileName,
            ImportedAt = DateTime.UtcNow,
            TotalRecords = rows.Count,
            Status = "Processing",
        };
        _db.PunchImportBatches.Add(batch);

        int success = 0, fail = 0;
        var errors = new List<string>();

        var employeeCodes = rows.Select(r => r.EmployeeCode).Distinct().ToList();
        var employees = await _db.Employees
            .Where(e => employeeCodes.Contains(e.EmployeeCode))
            .ToDictionaryAsync(e => e.EmployeeCode, e => e);

        var groupedByEmployee = rows.GroupBy(r => r.EmployeeCode);
        foreach (var empGroup in groupedByEmployee)
        {
            if (!employees.TryGetValue(empGroup.Key, out var employee))
            {
                var cnt = empGroup.Count();
                fail += cnt;
                errors.Add($"Employee code '{empGroup.Key}' not found ({cnt} records skipped)");
                continue;
            }

            var sortedPunches = empGroup.OrderBy(p => p.PunchTime).ToList();
            foreach (var punch in sortedPunches)
            {
                try
                {
                    var punchDate = punch.PunchTime.Date;
                    var existingRecord = await _db.AttendanceRecords
                        .FirstOrDefaultAsync(a => a.EmployeeId == employee.Id && a.Date == punchDate && a.PunchOut == null);

                    var isOut = punch.Direction?.Equals("out", StringComparison.OrdinalIgnoreCase) == true;

                    if (isOut && existingRecord != null)
                    {
                        existingRecord.PunchOut = punch.PunchTime;
                        existingRecord.WorkedHours = Math.Round(
                            (decimal)(punch.PunchTime - (existingRecord.PunchIn ?? punch.PunchTime)).TotalHours, 2);
                        existingRecord.Source = "Biometric";
                    }
                    else if (!isOut)
                    {
                        var alreadyExists = await _db.AttendanceRecords
                            .AnyAsync(a => a.EmployeeId == employee.Id && a.Date == punchDate && a.PunchIn != null && a.Source == "Biometric");
                        if (alreadyExists && existingRecord != null)
                        {
                            success++;
                            continue;
                        }

                        var newRecord = new AttendanceRecord
                        {
                            EmployeeId = employee.Id,
                            Date = punchDate,
                            PunchIn = punch.PunchTime,
                            Status = "Present",
                            Source = "Biometric",
                        };
                        _db.AttendanceRecords.Add(newRecord);
                    }
                    else
                    {
                        var newRecord = new AttendanceRecord
                        {
                            EmployeeId = employee.Id,
                            Date = punchDate,
                            PunchOut = punch.PunchTime,
                            Status = "Present",
                            Source = "Biometric",
                        };
                        _db.AttendanceRecords.Add(newRecord);
                    }
                    success++;
                }
                catch (Exception ex)
                {
                    fail++;
                    errors.Add($"Error processing punch for {empGroup.Key} at {punch.PunchTime}: {ex.Message}");
                }
            }
        }

        batch.SuccessCount = success;
        batch.FailCount = fail;
        batch.Status = fail == 0 ? "Completed" : "CompletedWithErrors";
        batch.ErrorDetails = errors.Count > 0 ? string.Join("\n", errors.Take(50)) : null;

        device.LastSyncAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return new PunchImportBatchDto
        {
            Id = batch.Id,
            FileName = batch.FileName,
            ImportedAt = batch.ImportedAt,
            TotalRecords = batch.TotalRecords,
            SuccessCount = batch.SuccessCount,
            FailCount = batch.FailCount,
            Status = batch.Status,
            ErrorDetails = batch.ErrorDetails,
            DeviceId = batch.DeviceId,
            DeviceName = device.Name,
        };
    }

    public async Task<List<PunchImportBatchDto>> GetImportHistoryAsync(Guid? deviceId = null)
    {
        var query = _db.PunchImportBatches
            .Include(b => b.Device)
            .AsQueryable();
        if (deviceId.HasValue)
            query = query.Where(b => b.DeviceId == deviceId.Value);

        return await query
            .OrderByDescending(b => b.ImportedAt)
            .Take(50)
            .Select(b => new PunchImportBatchDto
            {
                Id = b.Id,
                FileName = b.FileName,
                ImportedAt = b.ImportedAt,
                TotalRecords = b.TotalRecords,
                SuccessCount = b.SuccessCount,
                FailCount = b.FailCount,
                Status = b.Status,
                ErrorDetails = b.ErrorDetails,
                DeviceId = b.DeviceId,
                DeviceName = b.Device.Name,
            })
            .ToListAsync();
    }
}
