using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;

namespace OpenSkyHRM.Application.Interfaces;

public interface IEmployeeService
{
    Task<PagedResult<EmployeeDto>> GetAllAsync(int page = 1, int pageSize = 20, string? search = null, Guid? departmentId = null);
    Task<EmployeeDto?> GetByIdAsync(Guid id);
    Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto);
    Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto);
    Task<bool> DeleteAsync(Guid id);
}
