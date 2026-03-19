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
    Task<BusinessUnitDto?> UpdateBusinessUnitAsync(Guid id, CreateLookupDto dto);
    Task<bool> DeleteBusinessUnitAsync(Guid id);

    // Locations
    Task<List<LocationDto>> GetLocationsAsync();

    // Grades
    Task<List<GradeDto>> GetGradesAsync();
    Task<GradeDto> CreateGradeAsync(CreateGradeDto dto);
    Task<GradeDto?> UpdateGradeAsync(Guid id, CreateGradeDto dto);
    Task<bool> DeleteGradeAsync(Guid id);

    // Job Titles
    Task<List<JobTitleDto>> GetJobTitlesAsync();
    Task<JobTitleDto> CreateJobTitleAsync(CreateJobTitleDto dto);
    Task<JobTitleDto?> UpdateJobTitleAsync(Guid id, CreateJobTitleDto dto);
    Task<bool> DeleteJobTitleAsync(Guid id);

    // Positions
    Task<List<PositionDto>> GetPositionsAsync(Guid? departmentId = null);
}
