using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class RosterService : IRosterService
{
    private readonly AppDbContext _db;

    public RosterService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<RosterTemplateDto>> GetAllTemplatesAsync(bool includeInactive = false)
    {
        var query = _db.Set<RosterTemplate>()
            .Include(r => r.DefaultShiftPattern)
            .AsQueryable();
        if (!includeInactive)
            query = query.Where(r => r.IsActive);

        return await query
            .OrderBy(r => r.Code)
            .ThenBy(r => r.Name)
            .Select(r => new RosterTemplateDto
            {
                Id = r.Id,
                Code = r.Code,
                Name = r.Name,
                Description = r.Description,
                DefaultStartTime = r.DefaultStartTime,
                DefaultEndTime = r.DefaultEndTime,
                WorkHoursPerDay = r.WorkHoursPerDay,
                IsActive = r.IsActive,
                DefaultShiftPatternId = r.DefaultShiftPatternId,
                DefaultShiftPatternName = r.DefaultShiftPattern != null ? r.DefaultShiftPattern.Name : null,
            })
            .ToListAsync();
    }

    public async Task<RosterTemplateDto?> GetTemplateByIdAsync(Guid id)
    {
        var r = await _db.Set<RosterTemplate>()
            .Include(x => x.DefaultShiftPattern)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (r is null) return null;
        return new RosterTemplateDto
        {
            Id = r.Id,
            Code = r.Code,
            Name = r.Name,
            Description = r.Description,
            DefaultStartTime = r.DefaultStartTime,
            DefaultEndTime = r.DefaultEndTime,
            WorkHoursPerDay = r.WorkHoursPerDay,
            IsActive = r.IsActive,
            DefaultShiftPatternId = r.DefaultShiftPatternId,
            DefaultShiftPatternName = r.DefaultShiftPattern?.Name,
        };
    }

    public async Task<RosterTemplateDto> CreateTemplateAsync(CreateRosterTemplateDto dto)
    {
        var code = NormalizeCode(dto.Code);
        if (string.IsNullOrEmpty(code))
            throw new ArgumentException("Roster code is required.");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ArgumentException("Roster name is required.");
        await EnsureUniqueCodeAsync(code);

        var (startTime, endTime, workHours) = await ResolveTemplateTimesAsync(
            dto.DefaultShiftPatternId,
            dto.DefaultStartTime,
            dto.DefaultEndTime,
            dto.WorkHoursPerDay);

        var entity = new RosterTemplate
        {
            Code = code,
            Name = dto.Name.Trim(),
            Description = dto.Description,
            DefaultStartTime = startTime,
            DefaultEndTime = endTime,
            WorkHoursPerDay = workHours,
            IsActive = dto.IsActive,
            DefaultShiftPatternId = dto.DefaultShiftPatternId,
        };
        _db.Set<RosterTemplate>().Add(entity);
        await _db.SaveChangesAsync();
        return (await GetTemplateByIdAsync(entity.Id))!;
    }

    public async Task<RosterTemplateDto?> UpdateTemplateAsync(Guid id, UpdateRosterTemplateDto dto)
    {
        var entity = await _db.Set<RosterTemplate>().FindAsync(id);
        if (entity is null) return null;

        var code = NormalizeCode(dto.Code);
        if (string.IsNullOrEmpty(code))
            throw new ArgumentException("Roster code is required.");
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw new ArgumentException("Roster name is required.");
        await EnsureUniqueCodeAsync(code, id);

        var (startTime, endTime, workHours) = await ResolveTemplateTimesAsync(
            dto.DefaultShiftPatternId,
            dto.DefaultStartTime,
            dto.DefaultEndTime,
            dto.WorkHoursPerDay);

        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description;
        entity.DefaultStartTime = startTime;
        entity.DefaultEndTime = endTime;
        entity.WorkHoursPerDay = workHours;
        entity.IsActive = dto.IsActive;
        entity.DefaultShiftPatternId = dto.DefaultShiftPatternId;
        await _db.SaveChangesAsync();
        return await GetTemplateByIdAsync(id);
    }

    private static string NormalizeCode(string? code) => (code ?? string.Empty).Trim();

    private async Task<(TimeSpan Start, TimeSpan End, decimal WorkHours)> ResolveTemplateTimesAsync(
        Guid? shiftPatternId,
        TimeSpan defaultStart,
        TimeSpan defaultEnd,
        decimal workHours)
    {
        if (!shiftPatternId.HasValue)
            return (defaultStart, defaultEnd, workHours);

        var shift = await _db.Set<ShiftPattern>().FindAsync(shiftPatternId.Value);
        if (shift is null)
            return (defaultStart, defaultEnd, workHours);

        if (shift.ShiftType == "Open")
            return (TimeSpan.Zero, TimeSpan.Zero, workHours);

        if (shift.ShiftType == "Flexi")
        {
            var start = shift.FlexiWindowStart ?? defaultStart;
            var end = shift.FlexiWindowEnd ?? defaultEnd;
            var hours = shift.MinimumWorkHours ?? workHours;
            return (start, end, hours);
        }

        if (shift.ShiftType == "Split"
            && shift.Session2StartTime.HasValue
            && shift.Session2EndTime.HasValue)
        {
            var session1Hours = (decimal)(shift.EndTime - shift.StartTime).TotalHours;
            var session2Crosses = shift.IsNightShift
                || shift.Session2EndTime.Value <= shift.Session2StartTime.Value;
            var session2Hours = session2Crosses
                ? (decimal)(TimeSpan.FromHours(24) - shift.Session2StartTime.Value + shift.Session2EndTime.Value).TotalHours
                : (decimal)(shift.Session2EndTime.Value - shift.Session2StartTime.Value).TotalHours;
            var splitHours = Math.Max(0, session1Hours + session2Hours);
            return (shift.StartTime, shift.Session2EndTime.Value, splitHours);
        }

        var span = shift.EndTime >= shift.StartTime
            ? shift.EndTime - shift.StartTime
            : TimeSpan.FromHours(24) - shift.StartTime + shift.EndTime;
        var regularHours = (decimal)Math.Max(0, span.TotalHours);
        return (shift.StartTime, shift.EndTime, regularHours);
    }

    private async Task EnsureUniqueCodeAsync(string code, Guid? excludeId = null)
    {
        var exists = await _db.Set<RosterTemplate>()
            .AnyAsync(r => r.Code.ToLower() == code.ToLower()
                && (!excludeId.HasValue || r.Id != excludeId.Value));
        if (exists)
            throw new InvalidOperationException($"A roster template with code \"{code}\" already exists.");
    }

    public async Task<bool> DeleteTemplateAsync(Guid id, bool deleteAssignments = false)
    {
        var entity = await _db.Set<RosterTemplate>().FindAsync(id);
        if (entity is null) return false;

        if (deleteAssignments)
        {
            var linkedAssignments = await _db.Set<RosterAssignment>()
                .Where(a => a.RosterTemplateId == id)
                .ToListAsync();
            foreach (var assignment in linkedAssignments)
                assignment.IsDeleted = true;
        }

        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<RosterAssignmentDto>> GetAssignmentsAsync(
        Guid? employeeId = null,
        Guid? rosterTemplateId = null,
        DateTime? effectiveDate = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = _db.Set<RosterAssignment>()
            .Include(a => a.Employee)
            .Where(a => !a.IsDeleted)
            .AsQueryable();

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);
        if (rosterTemplateId.HasValue)
            query = query.Where(a => a.RosterTemplateId == rosterTemplateId.Value);
        if (effectiveDate.HasValue)
        {
            var d = effectiveDate.Value.Date;
            query = query.Where(a => a.EffectiveFrom <= d && (a.EffectiveTo == null || a.EffectiveTo >= d));
        }
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                query = query.Where(_ => false);
            else
                query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));
        }

        return await query
            .OrderByDescending(a => a.EffectiveFrom)
            .Select(a => new RosterAssignmentDto
            {
                Id = a.Id,
                EmployeeId = a.EmployeeId,
                EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
                EmployeeCode = a.Employee.EmployeeCode,
                RosterTemplateId = a.RosterTemplateId,
                RosterTemplateCode = _db.Set<RosterTemplate>().IgnoreQueryFilters()
                    .Where(rt => rt.Id == a.RosterTemplateId)
                    .Select(rt => rt.Code)
                    .FirstOrDefault() ?? "",
                RosterTemplateName = _db.Set<RosterTemplate>().IgnoreQueryFilters()
                    .Where(rt => rt.Id == a.RosterTemplateId)
                    .Select(rt => rt.Name)
                    .FirstOrDefault() ?? "Deleted template",
                EffectiveFrom = a.EffectiveFrom,
                EffectiveTo = a.EffectiveTo,
                Notes = a.Notes,
                DefaultShiftPatternName = _db.Set<RosterTemplate>().IgnoreQueryFilters()
                    .Where(rt => rt.Id == a.RosterTemplateId)
                    .Select(rt => rt.DefaultShiftPattern != null ? rt.DefaultShiftPattern.Name : null)
                    .FirstOrDefault(),
                WorkHoursPerDay = _db.Set<RosterTemplate>().IgnoreQueryFilters()
                    .Where(rt => rt.Id == a.RosterTemplateId)
                    .Select(rt => (decimal?)rt.WorkHoursPerDay)
                    .FirstOrDefault(),
            })
            .ToListAsync();
    }

    public async Task<RosterAssignmentDto?> GetAssignmentByIdAsync(Guid id)
    {
        var a = await _db.Set<RosterAssignment>()
            .Include(x => x.Employee)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;

        var template = await _db.Set<RosterTemplate>()
            .IgnoreQueryFilters()
            .Include(rt => rt.DefaultShiftPattern)
            .FirstOrDefaultAsync(rt => rt.Id == a.RosterTemplateId);

        return new RosterAssignmentDto
        {
            Id = a.Id,
            EmployeeId = a.EmployeeId,
            EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
            EmployeeCode = a.Employee.EmployeeCode,
            RosterTemplateId = a.RosterTemplateId,
            RosterTemplateCode = template?.Code ?? "",
            RosterTemplateName = template?.Name ?? "Deleted template",
            EffectiveFrom = a.EffectiveFrom,
            EffectiveTo = a.EffectiveTo,
            Notes = a.Notes,
            DefaultShiftPatternName = template?.DefaultShiftPattern?.Name,
            WorkHoursPerDay = template?.WorkHoursPerDay,
        };
    }

    public async Task<RosterAssignmentDto> CreateAssignmentAsync(CreateRosterAssignmentDto dto)
    {
        await ValidateNoOverlapAsync(dto.EmployeeId, dto.EffectiveFrom, dto.EffectiveTo, null);
        var template = await _db.Set<RosterTemplate>().FindAsync(dto.RosterTemplateId);
        if (template is null)
            throw new InvalidOperationException("Roster template not found.");
        var employee = await _db.Employees.FindAsync(dto.EmployeeId);
        if (employee is null)
            throw new InvalidOperationException("Employee not found.");

        var entity = new RosterAssignment
        {
            EmployeeId = dto.EmployeeId,
            RosterTemplateId = dto.RosterTemplateId,
            EffectiveFrom = dto.EffectiveFrom.Date,
            EffectiveTo = dto.EffectiveTo?.Date,
            Notes = dto.Notes,
        };
        _db.Set<RosterAssignment>().Add(entity);
        await _db.SaveChangesAsync();
        return (await GetAssignmentByIdAsync(entity.Id))!;
    }

    public async Task<RosterAssignmentDto?> UpdateAssignmentAsync(Guid id, UpdateRosterAssignmentDto dto)
    {
        var entity = await _db.Set<RosterAssignment>().FindAsync(id);
        if (entity is null) return null;
        await ValidateNoOverlapAsync(entity.EmployeeId, dto.EffectiveFrom, dto.EffectiveTo, id);
        entity.EffectiveFrom = dto.EffectiveFrom.Date;
        entity.EffectiveTo = dto.EffectiveTo?.Date;
        entity.Notes = dto.Notes;
        await _db.SaveChangesAsync();
        return await GetAssignmentByIdAsync(id);
    }

    public async Task<bool> DeleteAssignmentAsync(Guid id)
    {
        var updated = await _db.Set<RosterAssignment>()
            .IgnoreQueryFilters()
            .Where(x => x.Id == id && !x.IsDeleted)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.IsDeleted, true)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        return updated > 0;
    }

    public async Task<BulkAssignmentResultDto> BulkCreateAssignmentsAsync(BulkCreateRosterAssignmentDto dto)
    {
        var template = await _db.Set<RosterTemplate>().FindAsync(dto.RosterTemplateId);
        if (template is null)
            throw new InvalidOperationException("Roster template not found.");

        var result = new BulkAssignmentResultDto();
        var fromDate = dto.EffectiveFrom.Date;
        var toDate = dto.EffectiveTo?.Date;

        foreach (var empId in dto.EmployeeIds.Distinct())
        {
            var employee = await _db.Employees.FindAsync(empId);
            if (employee is null)
            {
                result.Skipped++;
                result.Errors.Add($"Employee {empId} not found");
                continue;
            }

            try
            {
                await ValidateNoOverlapAsync(empId, fromDate, toDate, null);
            }
            catch (InvalidOperationException)
            {
                result.Skipped++;
                result.Errors.Add($"{employee.FirstName} {employee.LastName} ({employee.EmployeeCode}): overlapping assignment exists");
                continue;
            }

            _db.Set<RosterAssignment>().Add(new RosterAssignment
            {
                EmployeeId = empId,
                RosterTemplateId = dto.RosterTemplateId,
                EffectiveFrom = fromDate,
                EffectiveTo = toDate,
                Notes = dto.Notes,
            });
            result.Created++;
        }

        await _db.SaveChangesAsync();
        return result;
    }

    private async Task ValidateNoOverlapAsync(Guid employeeId, DateTime from, DateTime? to, Guid? excludeId)
    {
        var fromDate = from.Date;
        var toDate = (to ?? fromDate).Date;
        if (toDate < fromDate)
            throw new InvalidOperationException("Effective To must be on or after Effective From.");

        var overlap = await _db.Set<RosterAssignment>()
            .Where(a => a.EmployeeId == employeeId && (excludeId == null || a.Id != excludeId))
            .AnyAsync(a => fromDate <= (a.EffectiveTo ?? DateTime.MaxValue.Date) && toDate >= a.EffectiveFrom);
        if (overlap)
            throw new InvalidOperationException("This employee already has a roster assignment that overlaps the given period. Adjust dates or remove the overlapping assignment.");
    }
}
