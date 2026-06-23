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
            .Include(e => e.ShiftPattern)
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
                await RebuildAttendanceForEmployeeDayAsync(employee, key.Day, cancellationToken);

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

    private async Task RebuildAttendanceForEmployeeDayAsync(
        Employee employee,
        DateTime calendarDate,
        CancellationToken cancellationToken = default)
    {
        var date = calendarDate.Date;
        var rosters = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate)
            .ThenInclude(rt => rt!.DefaultShiftPattern)
            .Where(ra => ra.EmployeeId == employee.Id)
            .ToListAsync(cancellationToken);

        var shiftYesterday = ShiftAttendanceCalculator.ResolveShiftPattern(employee, rosters, date.AddDays(-1));
        var shiftToday = ShiftAttendanceCalculator.ResolveShiftPattern(employee, rosters, date);
        var windowYesterday = shiftYesterday != null
            ? ShiftAttendanceCalculator.GetOvernightSplitWindow(shiftYesterday, date.AddDays(-1))
            : null;
        var windowToday = shiftToday != null
            ? ShiftAttendanceCalculator.GetOvernightSplitWindow(shiftToday, date)
            : null;

        if (windowYesterday != null)
            await RebuildOvernightSplitShiftAsync(employee, windowYesterday, rosters, cancellationToken);

        if (windowToday != null)
            await RebuildOvernightSplitShiftAsync(employee, windowToday, rosters, cancellationToken);

        if (windowToday == null)
            await RebuildStandardCalendarDayAsync(employee, date, windowYesterday, shiftToday, rosters, cancellationToken);

        if (windowYesterday != null)
            await CleanupSpilloverCalendarRecordAsync(employee, windowYesterday, shiftToday, date, cancellationToken);
    }

    private async Task RebuildOvernightSplitShiftAsync(
        Employee employee,
        ShiftAttendanceCalculator.SplitShiftWindow window,
        List<RosterAssignment> rosters,
        CancellationToken cancellationToken)
    {
        var punches = await _db.BiometricPunchEvents
            .Where(p => p.DeviceUserId == employee.EmployeeCode
                        && p.PunchAtUtc >= window.WindowStart
                        && p.PunchAtUtc <= window.WindowEnd)
            .OrderBy(p => p.PunchAtUtc)
            .ToListAsync(cancellationToken);

        var punchTimes = punches.Select(p => p.PunchAtUtc).ToList();
        var aggregation = ShiftAttendanceCalculator.AggregateOvernightSplitPunches(window, punchTimes);

        var record = await _db.AttendanceRecords
            .Where(a => a.EmployeeId == employee.Id && a.Date == window.ShiftDate && !a.IsDeleted)
            .OrderBy(a => a.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (!aggregation.PunchIn.HasValue)
        {
            if (record != null)
            {
                record.IsDeleted = true;
            }

            return;
        }

        if (record is null)
        {
            record = new AttendanceRecord
            {
                EmployeeId = employee.Id,
                Date = window.ShiftDate,
                Status = "Present",
                Source = "Biometric",
            };
            _db.AttendanceRecords.Add(record);
        }
        else
        {
            record.Source = "Biometric";
            record.IsDeleted = false;
        }

        record.PunchIn = aggregation.PunchIn;
        record.PunchOut = aggregation.PunchOut;
        record.WorkedHours = aggregation.WorkedHours;
        record.Status = "Present";
    }

    private async Task RebuildStandardCalendarDayAsync(
        Employee employee,
        DateTime calendarDate,
        ShiftAttendanceCalculator.SplitShiftWindow? previousWindow,
        ShiftPattern? shiftToday,
        List<RosterAssignment> rosters,
        CancellationToken cancellationToken)
    {
        var dayStart = calendarDate.Date;
        var dayEnd = dayStart.AddDays(1);

        var punches = await _db.BiometricPunchEvents
            .Where(p => p.DeviceUserId == employee.EmployeeCode && p.PunchAtUtc >= dayStart && p.PunchAtUtc < dayEnd)
            .OrderBy(p => p.PunchAtUtc)
            .ToListAsync(cancellationToken);

        var spillCutoff = previousWindow?.Session2End;
        var nextShiftStart = previousWindow != null
            ? ShiftAttendanceCalculator.GetNextShiftSessionStart(previousWindow.ShiftDate, shiftToday)
            : dayStart;

        var filtered = punches
            .Where(p => spillCutoff == null || p.PunchAtUtc > spillCutoff.Value || p.PunchAtUtc >= nextShiftStart)
            .ToList();

        if (filtered.Count == 0)
        {
            var existing = await _db.AttendanceRecords
                .Where(a => a.EmployeeId == employee.Id && a.Date == dayStart && !a.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            if (existing != null && previousWindow != null
                && ShiftAttendanceCalculator.IsSpilloverOnlyCalendarDay(
                    previousWindow,
                    shiftToday,
                    punches.Select(p => p.PunchAtUtc).ToList(),
                    existing.PunchIn,
                    existing.PunchOut))
            {
                existing.IsDeleted = true;
            }

            return;
        }

        var punchTimes = filtered.Select(p => p.PunchAtUtc).ToList();
        var isCheckOut = filtered.Select(p => IsCheckOut(p.PunchState)).ToList();
        var aggregation = ShiftAttendanceCalculator.AggregateCalendarDayPunches(punchTimes, isCheckOut);

        var record = await _db.AttendanceRecords
            .Where(a => a.EmployeeId == employee.Id && a.Date == dayStart && !a.IsDeleted)
            .OrderBy(a => a.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (record is null)
        {
            record = new AttendanceRecord
            {
                EmployeeId = employee.Id,
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

        record.PunchIn = aggregation.PunchIn;
        record.PunchOut = aggregation.PunchOut;
        record.WorkedHours = aggregation.WorkedHours;
        record.Status = "Present";
    }

    private async Task CleanupSpilloverCalendarRecordAsync(
        Employee employee,
        ShiftAttendanceCalculator.SplitShiftWindow previousWindow,
        ShiftPattern? shiftOnCalendarDay,
        DateTime calendarDate,
        CancellationToken cancellationToken)
    {
        if (calendarDate.Date != previousWindow.ShiftDate.AddDays(1).Date)
            return;

        var dayStart = calendarDate.Date;
        var dayEnd = dayStart.AddDays(1);
        var punches = await _db.BiometricPunchEvents
            .Where(p => p.DeviceUserId == employee.EmployeeCode && p.PunchAtUtc >= dayStart && p.PunchAtUtc < dayEnd)
            .OrderBy(p => p.PunchAtUtc)
            .Select(p => p.PunchAtUtc)
            .ToListAsync(cancellationToken);

        var record = await _db.AttendanceRecords
            .Where(a => a.EmployeeId == employee.Id && a.Date == dayStart && !a.IsDeleted)
            .FirstOrDefaultAsync(cancellationToken);

        if (record == null)
            return;

        if (ShiftAttendanceCalculator.IsSpilloverOnlyCalendarDay(
                previousWindow,
                shiftOnCalendarDay,
                punches,
                record.PunchIn,
                record.PunchOut))
        {
            record.IsDeleted = true;
        }
    }

    private async Task ApplyPunchToAttendanceAsync(Guid employeeId, DateTime punchTime, bool isOut)
    {
        var employee = await _db.Employees
            .Include(e => e.ShiftPattern)
            .FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return;

        await RebuildAttendanceForEmployeeDayAsync(employee, punchTime.Date);
        if (punchTime.TimeOfDay < TimeSpan.FromHours(6))
            await RebuildAttendanceForEmployeeDayAsync(employee, punchTime.Date.AddDays(-1));
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
