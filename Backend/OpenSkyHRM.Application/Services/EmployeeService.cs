using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class EmployeeService : IEmployeeService
{
    private readonly AppDbContext _db;

    public EmployeeService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<EmployeeDto>> GetAllAsync(int page = 1, int pageSize = 20, string? search = null, Guid? departmentId = null)
    {
        var query = _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLower();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(term) ||
                e.LastName.ToLower().Contains(term) ||
                e.EmployeeCode.ToLower().Contains(term) ||
                e.Email.ToLower().Contains(term));
        }

        if (departmentId.HasValue)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(e => e.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => MapToDto(e))
            .ToListAsync();

        return new PagedResult<EmployeeDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<EmployeeDto?> GetByIdAsync(Guid id)
    {
        var employee = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .FirstOrDefaultAsync(e => e.Id == id);

        return employee is null ? null : MapToDto(employee);
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto)
    {
        var employee = new Employee
        {
            EmployeeCode = dto.EmployeeCode,
            FirstName = dto.FirstName,
            LastName = dto.LastName,
            Email = dto.Email,
            Phone = dto.Phone,
            DateOfBirth = dto.DateOfBirth,
            Gender = Enum.Parse<Gender>(dto.Gender, true),
            JoinDate = dto.JoinDate,
            Status = EmploymentStatus.Active,
            DepartmentId = dto.DepartmentId,
            BusinessUnitId = dto.BusinessUnitId,
            PositionId = dto.PositionId,
            LocationId = dto.LocationId,
            GradeId = dto.GradeId,
            JobTitleId = dto.JobTitleId,
            ManagerId = dto.ManagerId,
        };

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        return (await GetByIdAsync(employee.Id))!;
    }

    public async Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return null;

        employee.FirstName = dto.FirstName;
        employee.LastName = dto.LastName;
        employee.Email = dto.Email;
        employee.Phone = dto.Phone;
        employee.DateOfBirth = dto.DateOfBirth;
        employee.Gender = Enum.Parse<Gender>(dto.Gender, true);
        employee.Status = Enum.Parse<EmploymentStatus>(dto.Status, true);
        employee.DepartmentId = dto.DepartmentId;
        employee.BusinessUnitId = dto.BusinessUnitId;
        employee.PositionId = dto.PositionId;
        employee.LocationId = dto.LocationId;
        employee.GradeId = dto.GradeId;
        employee.JobTitleId = dto.JobTitleId;
        employee.ManagerId = dto.ManagerId;

        await _db.SaveChangesAsync();
        return (await GetByIdAsync(id))!;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return false;

        employee.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private static EmployeeDto MapToDto(Employee e) => new()
    {
        Id = e.Id,
        EmployeeCode = e.EmployeeCode,
        FirstName = e.FirstName,
        LastName = e.LastName,
        FullName = e.FullName,
        Email = e.Email,
        Phone = e.Phone,
        DateOfBirth = e.DateOfBirth,
        Gender = e.Gender.ToString(),
        JoinDate = e.JoinDate,
        Status = e.Status.ToString(),
        DepartmentName = e.Department?.Name,
        BusinessUnitName = e.BusinessUnit?.Name,
        PositionTitle = e.Position?.Title,
        LocationName = e.Location?.Name,
        GradeName = e.Grade?.Name,
        JobTitleName = e.JobTitle?.Title,
        ManagerName = e.Manager != null ? $"{e.Manager.FirstName} {e.Manager.LastName}" : null,
        ManagerId = e.ManagerId,
    };
}
