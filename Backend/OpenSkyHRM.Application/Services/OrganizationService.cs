using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class OrganizationService : IOrganizationService
{
    private readonly AppDbContext _db;

    public OrganizationService(AppDbContext db)
    {
        _db = db;
    }

    // --- Departments ---

    public async Task<List<DepartmentDto>> GetDepartmentsAsync()
    {
        return await _db.Departments
            .Include(d => d.ParentDepartment)
            .Include(d => d.Employees)
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto
            {
                Id = d.Id,
                Name = d.Name,
                Code = d.Code,
                Description = d.Description,
                ParentDepartmentId = d.ParentDepartmentId,
                ParentDepartmentName = d.ParentDepartment != null ? d.ParentDepartment.Name : null,
                EmployeeCount = d.Employees.Count(e => !e.IsDeleted),
            })
            .ToListAsync();
    }

    public async Task<DepartmentDto?> GetDepartmentByIdAsync(Guid id)
    {
        var dept = await _db.Departments
            .Include(d => d.ParentDepartment)
            .Include(d => d.Employees)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dept is null) return null;

        return new DepartmentDto
        {
            Id = dept.Id,
            Name = dept.Name,
            Code = dept.Code,
            Description = dept.Description,
            ParentDepartmentId = dept.ParentDepartmentId,
            ParentDepartmentName = dept.ParentDepartment?.Name,
            EmployeeCount = dept.Employees.Count(e => !e.IsDeleted),
        };
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentDto dto)
    {
        var dept = new Department
        {
            Name = dto.Name,
            Code = dto.Code,
            Description = dto.Description,
            ParentDepartmentId = dto.ParentDepartmentId,
        };

        _db.Departments.Add(dept);
        await _db.SaveChangesAsync();
        return (await GetDepartmentByIdAsync(dept.Id))!;
    }

    public async Task<DepartmentDto?> UpdateDepartmentAsync(Guid id, UpdateDepartmentDto dto)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept is null) return null;

        dept.Name = dto.Name;
        dept.Code = dto.Code;
        dept.Description = dto.Description;
        dept.ParentDepartmentId = dto.ParentDepartmentId;

        await _db.SaveChangesAsync();
        return (await GetDepartmentByIdAsync(id))!;
    }

    public async Task<bool> DeleteDepartmentAsync(Guid id)
    {
        var dept = await _db.Departments.FindAsync(id);
        if (dept is null) return false;

        dept.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // --- Business Units ---

    public async Task<List<BusinessUnitDto>> GetBusinessUnitsAsync()
    {
        return await _db.BusinessUnits
            .Include(b => b.Employees)
            .OrderBy(b => b.Name)
            .Select(b => new BusinessUnitDto
            {
                Id = b.Id,
                Name = b.Name,
                Code = b.Code,
                Description = b.Description,
                IsActive = b.IsActive,
                EmployeeCount = b.Employees.Count(e => !e.IsDeleted),
            })
            .ToListAsync();
    }

    public async Task<BusinessUnitDto> CreateBusinessUnitAsync(CreateLookupDto dto)
    {
        var bu = new BusinessUnit { Name = dto.Name, Code = dto.Code, Description = dto.Description };
        _db.BusinessUnits.Add(bu);
        await _db.SaveChangesAsync();

        return new BusinessUnitDto
        {
            Id = bu.Id, Name = bu.Name, Code = bu.Code,
            Description = bu.Description, IsActive = bu.IsActive, EmployeeCount = 0
        };
    }

    // --- Locations ---

    public async Task<List<LocationDto>> GetLocationsAsync()
    {
        return await _db.Locations
            .OrderBy(l => l.Name)
            .Select(l => new LocationDto
            {
                Id = l.Id, Name = l.Name, Code = l.Code,
                Address = l.Address, City = l.City, Country = l.Country, IsActive = l.IsActive
            })
            .ToListAsync();
    }

    // --- Grades ---

    public async Task<List<GradeDto>> GetGradesAsync()
    {
        return await _db.Grades
            .OrderBy(g => g.Level)
            .Select(g => new GradeDto
            {
                Id = g.Id, Name = g.Name, Code = g.Code,
                Level = g.Level, Description = g.Description
            })
            .ToListAsync();
    }

    // --- Job Titles ---

    public async Task<List<JobTitleDto>> GetJobTitlesAsync()
    {
        return await _db.JobTitles
            .OrderBy(j => j.Title)
            .Select(j => new JobTitleDto
            {
                Id = j.Id, Name = j.Title, Code = j.Code, Description = j.Description
            })
            .ToListAsync();
    }

    // --- Positions ---

    public async Task<List<PositionDto>> GetPositionsAsync(Guid? departmentId = null)
    {
        var query = _db.Positions
            .Include(p => p.Department)
            .Include(p => p.Location)
            .Include(p => p.JobTitle)
            .AsQueryable();

        if (departmentId.HasValue)
            query = query.Where(p => p.DepartmentId == departmentId.Value);

        return await query
            .OrderBy(p => p.Title)
            .Select(p => new PositionDto
            {
                Id = p.Id,
                Title = p.Title,
                Code = p.Code,
                IsVacant = p.IsVacant,
                DepartmentName = p.Department.Name,
                LocationName = p.Location != null ? p.Location.Name : null,
                JobTitleName = p.JobTitle != null ? p.JobTitle.Title : null,
            })
            .ToListAsync();
    }
}
