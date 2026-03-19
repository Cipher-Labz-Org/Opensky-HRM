using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;

namespace OpenSkyHRM.Application.Interfaces;

public interface IPayrollService
{
    Task<List<CompensationComponentDto>> GetComponentsAsync();
    Task<List<EmployeeCompensationDto>> GetEmployeeCompensationAsync(Guid employeeId);
    Task<PagedResult<SalaryRevisionDto>> GetRevisionsAsync(int page = 1, int pageSize = 20);
    Task<PagedResult<PayrollBatchDto>> GetBatchesAsync(int page = 1, int pageSize = 20);
    Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null);
}
