using OpenSkyHRM.Application.DTOs.Organization;

namespace OpenSkyHRM.Application.Interfaces;

public interface IOrganizationService
{
    // Departments
    Task<List<DepartmentDto>> GetDepartmentsAsync();
    Task<DepartmentDto?> GetDepartmentByIdAsync(Guid id);
    Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentDto dto);
    Task<DepartmentDto?> UpdateDepartmentAsync(Guid id, UpdateDepartmentDto dto);
    Task<bool> DeleteDepartmentAsync(Guid id);

    // Business Units
    Task<List<BusinessUnitDto>> GetBusinessUnitsAsync();
    Task<BusinessUnitDto> CreateBusinessUnitAsync(CreateLookupDto dto);

    // Locations
    Task<List<LocationDto>> GetLocationsAsync();

    // Grades
    Task<List<GradeDto>> GetGradesAsync();

    // Job Titles
    Task<List<JobTitleDto>> GetJobTitlesAsync();

    // Positions
    Task<List<PositionDto>> GetPositionsAsync(Guid? departmentId = null);
}
