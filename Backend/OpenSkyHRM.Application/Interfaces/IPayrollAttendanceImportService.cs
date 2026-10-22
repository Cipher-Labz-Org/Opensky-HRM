using OpenSkyHRM.Application.DTOs.Payroll;

namespace OpenSkyHRM.Application.Interfaces;

public interface IPayrollAttendanceImportService
{
    Task<PayrollAttendanceImportPreviewDto> PreviewImportAsync(Guid batchId);
    Task<PayrollAttendanceImportResultDto> ImportAsync(Guid batchId);
    Task<PayrollEmployeeWorkedHoursDto> GetEmployeeWorkedHoursAsync(Guid batchId, Guid employeeId);
}
