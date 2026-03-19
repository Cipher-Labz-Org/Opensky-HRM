using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;

namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeService
{
    Task<PagedResult<EmployeeDto>> GetAllAsync(
        int page = 1, int pageSize = 20, string? search = null,
        Guid? departmentId = null, Guid? jobTitleId = null,
        Guid? locationId = null, Guid? managerId = null, string? status = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<EmployeeDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto);
    Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto);
    Task<bool> DeleteAsync(Guid id);
    Task<string?> UpdateProfileImageAsync(Guid id, string imageUrl);
}
