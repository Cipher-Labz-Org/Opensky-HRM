using OpenSkyHRM.Application.DTOs.Reports;

namespace OpenSkyHRM.Application.Interfaces;

public interface IReportService
{
    List<ReportCategoryDto> GetReportCatalog();
    Task<ReportResultDto> RunReportAsync(
        string category,
        string reportKey,
        Dictionary<string, string>? filters = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null);
}
