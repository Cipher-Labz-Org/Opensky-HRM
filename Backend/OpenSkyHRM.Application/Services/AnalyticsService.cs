using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Analytics;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AnalyticsService : IAnalyticsService
{
    private readonly AppDbContext _db;
    public AnalyticsService(AppDbContext db) { _db = db; }

    public async Task<HeadcountAnalyticsDto> GetHeadcountAnalyticsAsync()
    {
        var employees = await _db.Employees
            .Include(e => e.Department).Include(e => e.BusinessUnit)
            .ToListAsync();

        return new HeadcountAnalyticsDto
        {
            TotalEmployees = employees.Count,
            ActiveEmployees = employees.Count(e => e.Status == EmploymentStatus.Active),
            OnLeave = employees.Count(e => e.Status == EmploymentStatus.OnLeave),
            Terminated = employees.Count(e => e.Status == EmploymentStatus.Terminated),
            Probation = employees.Count(e => e.Status == EmploymentStatus.Probation),
            ByDepartment = employees.GroupBy(e => e.Department?.Name ?? "Unassigned").ToDictionary(g => g.Key, g => g.Count()),
            ByBusinessUnit = employees.Where(e => e.BusinessUnit != null).GroupBy(e => e.BusinessUnit!.Name).ToDictionary(g => g.Key, g => g.Count()),
        };
    }

    public async Task<List<ReportDefinitionDto>> GetReportsAsync()
    {
        return await _db.ReportDefinitions.Where(r => r.IsActive).OrderBy(r => r.Category).ThenBy(r => r.Name)
            .Select(r => new ReportDefinitionDto
            {
                Id = r.Id, Name = r.Name, Category = r.Category,
                Description = r.Description, OutputFormat = r.OutputFormat, IsActive = r.IsActive,
            }).ToListAsync();
    }
}
