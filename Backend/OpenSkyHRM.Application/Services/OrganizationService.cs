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
            .Include(d => d.BusinessUnit)
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
                BusinessUnitId = d.BusinessUnitId,
                BusinessUnitName = d.BusinessUnit != null ? d.BusinessUnit.Name : null,
                EmployeeCount = d.Employees.Count(e => !e.IsDeleted),
            })
            .ToListAsync();
    }

    public async Task<DepartmentDto?> GetDepartmentByIdAsync(Guid id)
    {
        var dept = await _db.Departments
            .Include(d => d.ParentDepartment)
            .Include(d => d.BusinessUnit)
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
            BusinessUnitId = dept.BusinessUnitId,
            BusinessUnitName = dept.BusinessUnit?.Name,
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
            BusinessUnitId = dto.BusinessUnitId,
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
        dept.BusinessUnitId = dto.BusinessUnitId;

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

    public async Task<BusinessUnitDto?> UpdateBusinessUnitAsync(Guid id, CreateLookupDto dto)
    {
        var bu = await _db.BusinessUnits.FindAsync(id);
        if (bu is null) return null;
        bu.Name = dto.Name;
        bu.Code = dto.Code;
        bu.Description = dto.Description;
        await _db.SaveChangesAsync();
        return new BusinessUnitDto
        {
            Id = bu.Id, Name = bu.Name, Code = bu.Code,
            Description = bu.Description, IsActive = bu.IsActive, EmployeeCount = 0
        };
    }

    public async Task<bool> DeleteBusinessUnitAsync(Guid id)
    {
        var bu = await _db.BusinessUnits.FindAsync(id);
        if (bu is null) return false;
        bu.IsDeleted = true;

        var linkedPlaces = await _db.AttendancePlaces
            .Where(p => p.BusinessUnitId == id && !p.IsDeleted)
            .ToListAsync();
        foreach (var place in linkedPlaces)
            place.IsDeleted = true;

        await _db.SaveChangesAsync();
        return true;
    }

    // --- Locations ---

    private static LocationDto ToLocationDto(Location l) => new()
    {
        Id = l.Id,
        Name = l.Name,
        Code = l.Code,
        Address = l.Address,
        City = l.City,
        Country = l.Country,
        IsActive = l.IsActive,
    };

    public async Task<List<LocationDto>> GetLocationsAsync()
    {
        return await _db.Locations
            .OrderBy(l => l.Name)
            .Select(l => new LocationDto
            {
                Id = l.Id, Name = l.Name, Code = l.Code,
                Address = l.Address, City = l.City, Country = l.Country, IsActive = l.IsActive,
            })
            .ToListAsync();
    }

    public async Task<LocationDto> CreateLocationAsync(CreateLocationDto dto)
    {
        var entity = new Location
        {
            Name = dto.Name,
            Code = dto.Code,
            Address = dto.Address,
            City = dto.City,
            Country = dto.Country,
            IsActive = dto.IsActive,
        };
        _db.Locations.Add(entity);
        await _db.SaveChangesAsync();
        return ToLocationDto(entity);
    }

    public async Task<LocationDto?> UpdateLocationAsync(Guid id, CreateLocationDto dto)
    {
        var entity = await _db.Locations.FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name;
        entity.Code = dto.Code;
        entity.Address = dto.Address;
        entity.City = dto.City;
        entity.Country = dto.Country;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return ToLocationDto(entity);
    }

    public async Task<bool> DeleteLocationAsync(Guid id)
    {
        var entity = await _db.Locations.FindAsync(id);
        if (entity is null) return false;
        var inUse = await _db.Employees.AnyAsync(e => e.LocationId == id);
        if (inUse)
            throw new InvalidOperationException("Cannot delete location: it is assigned to one or more employees.");
        entity.IsDeleted = true;

        var linkedPlaces = await _db.AttendancePlaces
            .Where(p => p.LocationId == id && !p.IsDeleted)
            .ToListAsync();
        foreach (var place in linkedPlaces)
            place.IsDeleted = true;

        await _db.SaveChangesAsync();
        return true;
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

    public async Task<GradeDto> CreateGradeAsync(CreateGradeDto dto)
    {
        var grade = new Grade { Name = dto.Name, Code = dto.Code, Level = dto.Level, Description = dto.Description };
        _db.Grades.Add(grade);
        await _db.SaveChangesAsync();
        return new GradeDto { Id = grade.Id, Name = grade.Name, Code = grade.Code, Level = grade.Level, Description = grade.Description };
    }

    public async Task<GradeDto?> UpdateGradeAsync(Guid id, CreateGradeDto dto)
    {
        var grade = await _db.Grades.FindAsync(id);
        if (grade is null) return null;
        grade.Name = dto.Name;
        grade.Code = dto.Code;
        grade.Level = dto.Level;
        grade.Description = dto.Description;
        await _db.SaveChangesAsync();
        return new GradeDto { Id = grade.Id, Name = grade.Name, Code = grade.Code, Level = grade.Level, Description = grade.Description };
    }

    public async Task<bool> DeleteGradeAsync(Guid id)
    {
        var grade = await _db.Grades.FindAsync(id);
        if (grade is null) return false;
        grade.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
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

    public async Task<JobTitleDto> CreateJobTitleAsync(CreateJobTitleDto dto)
    {
        var jt = new JobTitle { Title = dto.Title, Code = dto.Code, Description = dto.Description };
        _db.JobTitles.Add(jt);
        await _db.SaveChangesAsync();
        return new JobTitleDto { Id = jt.Id, Name = jt.Title, Code = jt.Code, Description = jt.Description };
    }

    public async Task<JobTitleDto?> UpdateJobTitleAsync(Guid id, CreateJobTitleDto dto)
    {
        var jt = await _db.JobTitles.FindAsync(id);
        if (jt is null) return null;
        jt.Title = dto.Title;
        jt.Code = dto.Code;
        jt.Description = dto.Description;
        await _db.SaveChangesAsync();
        return new JobTitleDto { Id = jt.Id, Name = jt.Title, Code = jt.Code, Description = jt.Description };
    }

    public async Task<bool> DeleteJobTitleAsync(Guid id)
    {
        var jt = await _db.JobTitles.FindAsync(id);
        if (jt is null) return false;
        jt.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
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

    public async Task<List<ReportingHierarchyNodeDto>> GetReportingHierarchyAsync()
    {
        var employees = await _db.Employees
            .Where(e => e.Status != "Terminated")
            .Select(e => new
            {
                e.Id,
                e.EmployeeCode,
                e.FirstName,
                e.MiddleName,
                e.LastName,
                e.IsTopOfHierarchy,
                e.ManagerId,
                JobTitleName = e.JobTitle != null ? e.JobTitle.Title : null,
                DepartmentName = e.Department != null ? e.Department.Name : null,
            })
            .ToListAsync();

        var supervisorLinks = await _db.Set<EmployeeSupervisor>()
            .OrderBy(x => x.CreatedAt)
            .Select(x => new { x.EmployeeId, x.SupervisorId, x.ReportingMethod, x.CreatedAt })
            .ToListAsync();

        var nodesById = employees.ToDictionary(
            e => e.Id,
            e => new ReportingHierarchyNodeDto
            {
                Id = e.Id,
                EmployeeCode = e.EmployeeCode,
                FullName = string.IsNullOrWhiteSpace(e.MiddleName)
                    ? $"{e.FirstName} {e.LastName}"
                    : $"{e.FirstName} {e.MiddleName} {e.LastName}",
                JobTitleName = e.JobTitleName,
                DepartmentName = e.DepartmentName,
                IsTopOfHierarchy = e.IsTopOfHierarchy,
            });

        // Keep one supervisor edge per employee; prefer Employee.ManagerId when set
        // (current profile value), otherwise use supervisor rows and prefer "Direct".
        var supervisorByEmployee = supervisorLinks
            .Where(x => nodesById.ContainsKey(x.EmployeeId) && nodesById.ContainsKey(x.SupervisorId))
            .GroupBy(x => x.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(x => string.Equals(x.ReportingMethod, "Direct", StringComparison.OrdinalIgnoreCase))
                    .ThenByDescending(x => x.CreatedAt)
                    .Select(x => x.SupervisorId)
                    .First());

        foreach (var employee in employees)
        {
            if (!employee.ManagerId.HasValue) continue;
            if (!nodesById.ContainsKey(employee.ManagerId.Value)) continue;
            if (employee.ManagerId.Value == employee.Id) continue;
            supervisorByEmployee[employee.Id] = employee.ManagerId.Value;
        }

        foreach (var pair in supervisorByEmployee)
        {
            var employeeId = pair.Key;
            var supervisorId = pair.Value;
            if (employeeId == supervisorId) continue;
            nodesById[supervisorId].Children.Add(nodesById[employeeId]);
        }

        var roots = nodesById.Values
            .Where(n => !supervisorByEmployee.ContainsKey(n.Id))
            .OrderByDescending(n => n.IsTopOfHierarchy)
            .ThenBy(n => n.FullName)
            .ToList();

        if (roots.Count == 0)
            roots = nodesById.Values.OrderBy(n => n.FullName).ToList();

        var visited = new HashSet<Guid>();
        foreach (var root in roots)
            SortAndBreakCycles(root, visited);

        var unattached = nodesById.Values
            .Where(n => !visited.Contains(n.Id))
            .OrderBy(n => n.FullName)
            .ToList();

        roots.AddRange(unattached);
        return roots;
    }

    private static void SortAndBreakCycles(ReportingHierarchyNodeDto node, HashSet<Guid> visited)
    {
        if (!visited.Add(node.Id))
        {
            node.Children.Clear();
            return;
        }

        node.Children = node.Children.OrderBy(c => c.FullName).ToList();
        foreach (var child in node.Children)
            SortAndBreakCycles(child, visited);
    }

    // --- Employment Status Types ---

    public async Task<List<EmploymentStatusTypeDto>> GetEmploymentStatusTypesAsync()
    {
        return await _db.EmploymentStatusTypes
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new EmploymentStatusTypeDto
            {
                Id = s.Id, Name = s.Name, Code = s.Code,
                Description = s.Description, IsActive = s.IsActive,
                IsSystem = s.IsSystem, SortOrder = s.SortOrder
            })
            .ToListAsync();
    }

    public async Task<EmploymentStatusTypeDto> CreateEmploymentStatusTypeAsync(CreateEmploymentStatusTypeDto dto)
    {
        var entity = new EmploymentStatusType
        {
            Name = dto.Name, Code = dto.Code, Description = dto.Description,
            IsActive = dto.IsActive, SortOrder = dto.SortOrder
        };
        _db.EmploymentStatusTypes.Add(entity);
        await _db.SaveChangesAsync();
        return new EmploymentStatusTypeDto
        {
            Id = entity.Id, Name = entity.Name, Code = entity.Code,
            Description = entity.Description, IsActive = entity.IsActive,
            IsSystem = entity.IsSystem, SortOrder = entity.SortOrder
        };
    }

    public async Task<EmploymentStatusTypeDto?> UpdateEmploymentStatusTypeAsync(Guid id, CreateEmploymentStatusTypeDto dto)
    {
        var entity = await _db.EmploymentStatusTypes.FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name;
        entity.Code = dto.Code;
        entity.Description = dto.Description;
        entity.IsActive = dto.IsActive;
        entity.SortOrder = dto.SortOrder;
        await _db.SaveChangesAsync();
        return new EmploymentStatusTypeDto
        {
            Id = entity.Id, Name = entity.Name, Code = entity.Code,
            Description = entity.Description, IsActive = entity.IsActive,
            IsSystem = entity.IsSystem, SortOrder = entity.SortOrder
        };
    }

    public async Task<bool> DeleteEmploymentStatusTypeAsync(Guid id)
    {
        var entity = await _db.EmploymentStatusTypes.FindAsync(id);
        if (entity is null) return false;
        if (entity.IsSystem)
            throw new InvalidOperationException("Cannot delete a system-defined status type.");
        var inUse = await _db.Employees.AnyAsync(e => e.EmploymentType == entity.Code);
        if (inUse)
            throw new InvalidOperationException("Cannot delete status: it is assigned to one or more employees.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // --- Employee Status Types ---

    public async Task<List<EmploymentStatusTypeDto>> GetEmployeeStatusTypesAsync()
    {
        return await _db.EmployeeStatusTypes
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .Select(s => new EmploymentStatusTypeDto
            {
                Id = s.Id, Name = s.Name, Code = s.Code,
                Description = s.Description, IsActive = s.IsActive,
                IsSystem = s.IsSystem, SortOrder = s.SortOrder
            })
            .ToListAsync();
    }

    public async Task<EmploymentStatusTypeDto> CreateEmployeeStatusTypeAsync(CreateEmploymentStatusTypeDto dto)
    {
        var entity = new EmployeeStatusType
        {
            Name = dto.Name, Code = dto.Code, Description = dto.Description,
            IsActive = dto.IsActive, SortOrder = dto.SortOrder
        };
        _db.EmployeeStatusTypes.Add(entity);
        await _db.SaveChangesAsync();
        return new EmploymentStatusTypeDto
        {
            Id = entity.Id, Name = entity.Name, Code = entity.Code,
            Description = entity.Description, IsActive = entity.IsActive,
            IsSystem = entity.IsSystem, SortOrder = entity.SortOrder
        };
    }

    public async Task<EmploymentStatusTypeDto?> UpdateEmployeeStatusTypeAsync(Guid id, CreateEmploymentStatusTypeDto dto)
    {
        var entity = await _db.EmployeeStatusTypes.FindAsync(id);
        if (entity is null) return null;
        entity.Name = dto.Name;
        entity.Code = dto.Code;
        entity.Description = dto.Description;
        entity.IsActive = dto.IsActive;
        entity.SortOrder = dto.SortOrder;
        await _db.SaveChangesAsync();
        return new EmploymentStatusTypeDto
        {
            Id = entity.Id, Name = entity.Name, Code = entity.Code,
            Description = entity.Description, IsActive = entity.IsActive,
            IsSystem = entity.IsSystem, SortOrder = entity.SortOrder
        };
    }

    public async Task<bool> DeleteEmployeeStatusTypeAsync(Guid id)
    {
        var entity = await _db.EmployeeStatusTypes.FindAsync(id);
        if (entity is null) return false;
        if (entity.IsSystem)
            throw new InvalidOperationException("Cannot delete a system-defined status type.");
        var inUse = await _db.Employees.AnyAsync(e => e.Status == entity.Code);
        if (inUse)
            throw new InvalidOperationException("Cannot delete status: it is assigned to one or more employees.");
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // --- Skills catalog ---

    public async Task<List<SkillCatalogDto>> GetSkillsCatalogAsync()
    {
        return await _db.Skills
            .Where(s => !s.IsDeleted)
            .OrderBy(s => s.Name)
            .Select(s => new SkillCatalogDto
            {
                Id = s.Id,
                Name = s.Name,
                Category = s.Category,
                Description = s.Description,
                IsActive = s.IsActive,
            })
            .ToListAsync();
    }

    public async Task<SkillCatalogDto> CreateSkillCatalogAsync(CreateSkillCatalogDto dto)
    {
        var name = dto.Name.Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Skill name is required.");

        var entity = new Skill
        {
            Name = name,
            Category = string.IsNullOrWhiteSpace(dto.Category) ? null : dto.Category.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsActive = dto.IsActive,
        };
        _db.Skills.Add(entity);
        await _db.SaveChangesAsync();
        return new SkillCatalogDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Category = entity.Category,
            Description = entity.Description,
            IsActive = entity.IsActive,
        };
    }

    public async Task<SkillCatalogDto?> UpdateSkillCatalogAsync(Guid id, CreateSkillCatalogDto dto)
    {
        var entity = await _db.Skills.FindAsync(id);
        if (entity is null) return null;

        var name = dto.Name.Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Skill name is required.");

        entity.Name = name;
        entity.Category = string.IsNullOrWhiteSpace(dto.Category) ? null : dto.Category.Trim();
        entity.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return new SkillCatalogDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Category = entity.Category,
            Description = entity.Description,
            IsActive = entity.IsActive,
        };
    }

    public async Task<bool> DeleteSkillCatalogAsync(Guid id)
    {
        var entity = await _db.Skills.FindAsync(id);
        if (entity is null) return false;

        var inMatrix = await _db.SkillMatrices.AnyAsync(sm => sm.SkillId == id);
        if (inMatrix)
            throw new InvalidOperationException("Cannot delete this skill: it is used in the skill matrix.");

        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // --- Employee attachment types (People profile) ---

    public async Task<List<EmployeeAttachmentTypeCatalogDto>> GetEmployeeAttachmentTypesCatalogAsync()
    {
        return await _db.EmployeeAttachmentTypes
            .Where(t => !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .ThenBy(t => t.Name)
            .Select(t => new EmployeeAttachmentTypeCatalogDto
            {
                Id = t.Id,
                Name = t.Name,
                Code = t.Code,
                Description = t.Description,
                IsActive = t.IsActive,
                SortOrder = t.SortOrder,
            })
            .ToListAsync();
    }

    public async Task<EmployeeAttachmentTypeCatalogDto> CreateEmployeeAttachmentTypeAsync(CreateEmployeeAttachmentTypeDto dto)
    {
        var name = dto.Name.Trim();
        var code = dto.Code.Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Name is required.");
        if (string.IsNullOrEmpty(code))
            throw new InvalidOperationException("Code is required.");

        var dup = await _db.EmployeeAttachmentTypes.AnyAsync(t => t.Code == code);
        if (dup)
            throw new InvalidOperationException("An attachment type with this code already exists.");

        var entity = new EmployeeAttachmentType
        {
            Name = name,
            Code = code,
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsActive = dto.IsActive,
            SortOrder = dto.SortOrder,
        };
        _db.EmployeeAttachmentTypes.Add(entity);
        await _db.SaveChangesAsync();
        return new EmployeeAttachmentTypeCatalogDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Code = entity.Code,
            Description = entity.Description,
            IsActive = entity.IsActive,
            SortOrder = entity.SortOrder,
        };
    }

    public async Task<EmployeeAttachmentTypeCatalogDto?> UpdateEmployeeAttachmentTypeAsync(Guid id, CreateEmployeeAttachmentTypeDto dto)
    {
        var entity = await _db.EmployeeAttachmentTypes.FindAsync(id);
        if (entity is null) return null;

        var name = dto.Name.Trim();
        var code = dto.Code.Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Name is required.");
        if (string.IsNullOrEmpty(code))
            throw new InvalidOperationException("Code is required.");

        var dup = await _db.EmployeeAttachmentTypes.AnyAsync(t => t.Code == code && t.Id != id);
        if (dup)
            throw new InvalidOperationException("An attachment type with this code already exists.");

        entity.Name = name;
        entity.Code = code;
        entity.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        entity.IsActive = dto.IsActive;
        entity.SortOrder = dto.SortOrder;
        await _db.SaveChangesAsync();
        return new EmployeeAttachmentTypeCatalogDto
        {
            Id = entity.Id,
            Name = entity.Name,
            Code = entity.Code,
            Description = entity.Description,
            IsActive = entity.IsActive,
            SortOrder = entity.SortOrder,
        };
    }

    public async Task<bool> DeleteEmployeeAttachmentTypeAsync(Guid id)
    {
        var entity = await _db.EmployeeAttachmentTypes.FindAsync(id);
        if (entity is null) return false;

        var inUse = await _db.EmployeeAttachments.AnyAsync(a => a.AttachmentTypeId == id && !a.IsDeleted);
        if (inUse)
            throw new InvalidOperationException("Cannot delete this type: it is used on one or more employee attachments.");

        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }
}
