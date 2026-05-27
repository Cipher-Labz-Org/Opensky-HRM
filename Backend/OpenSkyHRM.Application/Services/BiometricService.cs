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
            .Where(d => !d.IsDeleted)
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
                    var isOut = punch.Direction?.Equals("out", StringComparison.OrdinalIgnoreCase) == true;
                    await ApplyPunchToAttendanceAsync(employee.Id, punch.PunchTime, isOut);
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

    public async Task<AdmsProcessResultDto> ProcessAdmsPunchesToAttendanceAsync(CancellationToken cancellationToken = default)
    {
        var pending = await _db.BiometricPunchEvents
            .Where(x => !x.ProcessedToAttendance)
            .OrderBy(x => x.PunchAtUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        if (pending.Count == 0)
            return new AdmsProcessResultDto();

        var userIds = pending.Select(p => p.DeviceUserId).Distinct().ToList();
        var employees = await _db.Employees
            .Where(e => userIds.Contains(e.EmployeeCode))
            .ToDictionaryAsync(e => e.EmployeeCode, e => e, cancellationToken);

        var processed = 0;
        var skipped = 0;
        var failed = 0;

        var dayKeys = pending
            .Select(p => new { p.DeviceUserId, Day = p.PunchAtUtc.Date })
            .Distinct()
            .ToList();

        foreach (var key in dayKeys)
        {
            if (!employees.TryGetValue(key.DeviceUserId, out var employee))
            {
                skipped += pending.Count(p => p.DeviceUserId == key.DeviceUserId && p.PunchAtUtc.Date == key.Day);
                continue;
            }

            try
            {
                await RebuildAttendanceForEmployeeDayAsync(employee.Id, employee.EmployeeCode, key.Day, cancellationToken);

                var dayPunches = pending.Where(p => p.DeviceUserId == key.DeviceUserId && p.PunchAtUtc.Date == key.Day).ToList();
                foreach (var punch in dayPunches)
                {
                    punch.ProcessedToAttendance = true;
                    processed++;
                }
            }
            catch
            {
                failed += pending.Count(p => p.DeviceUserId == key.DeviceUserId && p.PunchAtUtc.Date == key.Day);
            }
        }

        if (processed > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return new AdmsProcessResultDto
        {
            Processed = processed,
            SkippedUnmapped = skipped,
            Failed = failed,
        };
    }

    /// <summary>
    /// SenseFace / ADMS often sends CheckingStatus 255 for every punch. Use first punch = in, last punch = out.
    /// </summary>
    private async Task RebuildAttendanceForEmployeeDayAsync(
        Guid employeeId,
        string employeeCode,
        DateTime date,
        CancellationToken cancellationToken = default)
    {
        var dayStart = date.Date;
        var dayEnd = dayStart.AddDays(1);

        var punches = await _db.BiometricPunchEvents
            .Where(p => p.DeviceUserId == employeeCode && p.PunchAtUtc >= dayStart && p.PunchAtUtc < dayEnd)
            .OrderBy(p => p.PunchAtUtc)
            .ToListAsync(cancellationToken);

        if (punches.Count == 0)
            return;

        var punchIn = punches[0].PunchAtUtc;
        var punchOut = punches.Count > 1 ? punches[^1].PunchAtUtc : (DateTime?)null;

        var checkOuts = punches.Where(p => IsCheckOut(p.PunchState)).Select(p => p.PunchAtUtc).ToList();
        if (checkOuts.Count > 0)
            punchOut = checkOuts.Max();

        var record = await _db.AttendanceRecords
            .Where(a => a.EmployeeId == employeeId && a.Date == dayStart)
            .OrderBy(a => a.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (record is null)
        {
            record = new AttendanceRecord
            {
                EmployeeId = employeeId,
                Date = dayStart,
                Status = "Present",
                Source = "Biometric",
            };
            _db.AttendanceRecords.Add(record);
        }
        else
        {
            record.Source = "Biometric";
        }

        record.PunchIn = punchIn;
        record.PunchOut = punchOut;

        if (record.PunchIn.HasValue && record.PunchOut.HasValue && record.PunchOut > record.PunchIn)
        {
            record.WorkedHours = Math.Round(
                (decimal)(record.PunchOut.Value - record.PunchIn.Value).TotalHours, 2);
        }
        else
        {
            record.WorkedHours = null;
        }
    }

    private async Task ApplyPunchToAttendanceAsync(Guid employeeId, DateTime punchTime, bool isOut)
    {
        var employee = await _db.Employees.FindAsync(employeeId);
        if (employee is null) return;
        await RebuildAttendanceForEmployeeDayAsync(employee.Id, employee.EmployeeCode, punchTime.Date);
    }

    private static bool IsCheckOut(string? punchState)
    {
        if (string.IsNullOrWhiteSpace(punchState))
            return false;

        var s = punchState.Trim().ToLowerInvariant();
        return s is "1" or "out" or "checkout" or "check-out" or "check out";
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
