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
            .OrderBy(r => r.Name)
            .Select(r => new RosterTemplateDto
            {
                Id = r.Id,
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
        var entity = new RosterTemplate
        {
            Name = dto.Name,
            Description = dto.Description,
            DefaultStartTime = dto.DefaultStartTime,
            DefaultEndTime = dto.DefaultEndTime,
            WorkHoursPerDay = dto.WorkHoursPerDay,
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
        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.DefaultStartTime = dto.DefaultStartTime;
        entity.DefaultEndTime = dto.DefaultEndTime;
        entity.WorkHoursPerDay = dto.WorkHoursPerDay;
        entity.IsActive = dto.IsActive;
        entity.DefaultShiftPatternId = dto.DefaultShiftPatternId;
        await _db.SaveChangesAsync();
        return await GetTemplateByIdAsync(id);
    }

    public async Task<bool> DeleteTemplateAsync(Guid id)
    {
        var entity = await _db.Set<RosterTemplate>().FindAsync(id);
        if (entity is null) return false;
        var inUse = await _db.Set<RosterAssignment>().AnyAsync(a => a.RosterTemplateId == id);
        if (inUse)
            throw new InvalidOperationException("Cannot delete roster template: it has assignments. Remove assignments first.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<RosterAssignmentDto>> GetAssignmentsAsync(Guid? employeeId = null, Guid? rosterTemplateId = null, DateTime? effectiveDate = null)
    {
        var query = _db.Set<RosterAssignment>()
            .Include(a => a.Employee)
            .Include(a => a.RosterTemplate)
                .ThenInclude(rt => rt.DefaultShiftPattern)
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

        return await query
            .OrderByDescending(a => a.EffectiveFrom)
            .Select(a => new RosterAssignmentDto
            {
                Id = a.Id,
                EmployeeId = a.EmployeeId,
                EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
                EmployeeCode = a.Employee.EmployeeCode,
                RosterTemplateId = a.RosterTemplateId,
                RosterTemplateName = a.RosterTemplate.Name,
                EffectiveFrom = a.EffectiveFrom,
                EffectiveTo = a.EffectiveTo,
                Notes = a.Notes,
                DefaultShiftPatternName = a.RosterTemplate.DefaultShiftPattern != null
                    ? a.RosterTemplate.DefaultShiftPattern.Name
                    : null,
                WorkHoursPerDay = a.RosterTemplate.WorkHoursPerDay,
            })
            .ToListAsync();
    }

    public async Task<RosterAssignmentDto?> GetAssignmentByIdAsync(Guid id)
    {
        var a = await _db.Set<RosterAssignment>()
            .Include(x => x.Employee)
            .Include(x => x.RosterTemplate)
                .ThenInclude(rt => rt.DefaultShiftPattern)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return null;
        return new RosterAssignmentDto
        {
            Id = a.Id,
            EmployeeId = a.EmployeeId,
            EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
            EmployeeCode = a.Employee.EmployeeCode,
            RosterTemplateId = a.RosterTemplateId,
            RosterTemplateName = a.RosterTemplate.Name,
            EffectiveFrom = a.EffectiveFrom,
            EffectiveTo = a.EffectiveTo,
            Notes = a.Notes,
            DefaultShiftPatternName = a.RosterTemplate.DefaultShiftPattern?.Name,
            WorkHoursPerDay = a.RosterTemplate.WorkHoursPerDay,
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
        var entity = await _db.Set<RosterAssignment>().IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
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
