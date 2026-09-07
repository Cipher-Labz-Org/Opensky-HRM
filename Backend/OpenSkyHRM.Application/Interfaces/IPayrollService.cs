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
    Task<EmployeeApitSummaryDto> GetEmployeeApitSummaryAsync(Guid employeeId, string? taxMode, int? calendarMonth);
    Task<EmployeeApitSummaryDto> UpdateEmployeeApitTaxModeAsync(Guid employeeId, string taxMode);
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
    Task<PayrollBatchDto?> ReviewBatchAsync(Guid id, string reviewedBy);
    Task<PayrollBatchDto?> ApproveBatchAsync(Guid id, string approvedBy);
    Task<PayrollBatchDto?> ReturnBatchToCalculatedAsync(Guid id);
    Task<PayrollBatchDto?> FinalizeBatchAsync(Guid id);
    Task<bool> DeleteBatchAsync(Guid id);

    // Pay Statements
    Task<PagedResult<PayStatementDto>> GetStatementsAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, string? search = null, IReadOnlyList<Guid>? allowedEmployeeIds = null, Guid? batchId = null);
    Task<PayStatementDto?> GetStatementByIdAsync(Guid id);
    Task<List<PayStatementDto>> GetStatementsByBatchAsync(Guid batchId);
    Task<List<PayStatementDto>> GetStatementsByEmployeeAsync(Guid employeeId);

    // Settings
    Task<PayrollSettingsDto> GetPayrollSettingsAsync();
    Task<PayrollSettingsDto> UpdatePayrollSettingsAsync(PayrollSettingsDto dto);
}
