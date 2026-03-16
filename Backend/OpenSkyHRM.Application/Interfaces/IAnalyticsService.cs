using OpenSkyHRM.Application.DTOs.Analytics;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAnalyticsService
{
    Task<HeadcountAnalyticsDto> GetHeadcountAnalyticsAsync();
    Task<List<ReportDefinitionDto>> GetReportsAsync();
}
