using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Jobs;

public class ReportGenerationJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<ReportGenerationJob> _logger;

    public ReportGenerationJob(AppDbContext db, ILogger<ReportGenerationJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        _logger.LogInformation("Running scheduled report generation...");

        var schedules = await _db.ReportSchedules
            .Include(s => s.ReportDefinition)
            .Where(s => s.IsActive && (s.NextRunAt == null || s.NextRunAt <= DateTime.UtcNow))
            .ToListAsync();

        foreach (var schedule in schedules)
        {
            _logger.LogInformation("Generating report: {ReportName} ({Format})",
                schedule.ReportDefinition.Name, schedule.ReportDefinition.OutputFormat);

            schedule.LastRunAt = DateTime.UtcNow;
            schedule.NextRunAt = DateTime.UtcNow.AddDays(1);
        }

        if (schedules.Count > 0)
            await _db.SaveChangesAsync();

        _logger.LogInformation("Report generation completed. {Count} reports processed.", schedules.Count);
    }
}
