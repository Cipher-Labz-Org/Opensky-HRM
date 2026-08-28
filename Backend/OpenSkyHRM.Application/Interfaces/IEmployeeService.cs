using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;

namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeService
{
    Task<PagedResult<EmployeeDto>> GetAllAsync(
        int page = 1, int pageSize = 20, string? search = null,
        Guid? departmentId = null, Guid? jobTitleId = null,
        Guid? locationId = null, Guid? managerId = null, string? status = null,
        string? employmentType = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null, bool excludeTerminated = false,
        string? sortBy = null, string? sortDir = null);
    Task<PagedResult<EmployeeLookupDto>> GetLookupAsync(
        int pageSize = 50, string? search = null, Guid? departmentId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null, bool excludeTerminated = true);
    Task<EmployeeDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto);
    Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<string?> UpdateProfileImageAsync(Guid id, string imageUrl);

    Task<PagedResult<PeopleAuditLogEntryDto>> GetPeopleAuditTrailAsync(
        Guid? subjectEmployeeId,
        string? employeeSearch,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        int page = 1,
        int pageSize = 50);
}
