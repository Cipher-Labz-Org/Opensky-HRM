using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Payroll;

namespace OpenSkyHRM.Application.Interfaces;

public interface IPayrollService
{
    // Compensation Components
    Task<List<CompensationComponentDto>> GetComponentsAsync();
    Task<CompensationComponentDto?> GetComponentByIdAsync(Guid id);
    Task<CompensationComponentDto> CreateComponentAsync(CreateComponentDto dto);
    Task<CompensationComponentDto?> UpdateComponentAsync(Guid id, UpdateComponentDto dto);
    Task<bool> DeleteComponentAsync(Guid id);

    // Employee Compensation
    Task<List<EmployeeCompensationDto>> GetEmployeeCompensationAsync(Guid employeeId);
    Task<EmployeeCompensationDto> CreateEmployeeCompensationAsync(Guid employeeId, CreateEmployeeCompensationDto dto);
    Task<EmployeeCompensationDto?> UpdateEmployeeCompensationAsync(Guid id, UpdateEmployeeCompensationDto dto);
    Task<bool> DeleteEmployeeCompensationAsync(Guid id);

    // Salary Revisions
    Task<PagedResult<SalaryRevisionDto>> GetRevisionsAsync(int page = 1, int pageSize = 20);
    Task<SalaryRevisionDto> CreateRevisionAsync(CreateSalaryRevisionDto dto);
    Task<SalaryRevisionDto?> ApproveRevisionAsync(Guid id, string approvedBy);
    Task<SalaryRevisionDto?> RejectRevisionAsync(Guid id, string rejectedBy, string? remarks);

    // Payroll Batches
    Task<PagedResult<PayrollBatchDto>> GetBatchesAsync(int page = 1, int pageSize = 20);
    Task<PayrollBatchDto?> GetBatchByIdAsync(Guid id);
    Task<PayrollBatchDto> CreateBatchAsync(CreatePayrollBatchDto dto);
    Task<PayrollBatchDto?> UpdateBatchAsync(Guid id, UpdatePayrollBatchDto dto);
    Task<bool> DeleteBatchAsync(Guid id);

    // Pay Statements
    Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null);
    Task<PayStatementDto?> GetStatementByIdAsync(Guid id);
    Task<List<PayStatementDto>> GetStatementsByEmployeeAsync(Guid employeeId);

    // Settings
    Task<PayrollSettingsDto> GetPayrollSettingsAsync();
    Task<PayrollSettingsDto> UpdatePayrollSettingsAsync(PayrollSettingsDto dto);

    // Salary advance requests
    Task<List<PayrollAdvanceBatchOptionDto>> GetActivePayrunBatchOptionsForAdvanceAsync();
    Task<List<SalaryAdvanceRequestDto>> GetSalaryAdvanceRequestsForEmployeeAsync(Guid employeeId);
    Task<List<SalaryAdvanceRequestDto>> GetSalaryAdvanceRequestsForHrAsync(string? status, IReadOnlyList<Guid>? allowedEmployeeIds);
    Task<SalaryAdvanceRequestDto> CreateSalaryAdvanceRequestAsync(Guid employeeId, CreateSalaryAdvanceRequestDto dto);
    Task<SalaryAdvanceRequestDto?> ApproveSalaryAdvanceRequestAsync(Guid id, string reviewedBy);
    Task<SalaryAdvanceRequestDto?> RejectSalaryAdvanceRequestAsync(Guid id, string reviewedBy, string? reason);
    /// <summary>
    /// Upserts ADVANCE variable deductions from approved salary advance requests for the batch
    /// (call before payroll calculate; also runs on each approve).
    /// </summary>
    Task ReconcileSalaryAdvanceDeductionLinesForBatchAsync(Guid payrollBatchId);
}
