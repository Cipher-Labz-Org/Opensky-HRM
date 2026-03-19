using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Jobs;

public class AttendanceReconciliationJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<AttendanceReconciliationJob> _logger;

    public AttendanceReconciliationJob(AppDbContext db, ILogger<AttendanceReconciliationJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var yesterday = DateTime.UtcNow.Date.AddDays(-1);
        _logger.LogInformation("Running attendance reconciliation for {Date}", yesterday);

        var employeesWithRecords = await _db.Set<AttendanceRecord>()
            .Where(a => a.Date.Date == yesterday)
            .Select(a => a.EmployeeId)
            .Distinct()
            .ToListAsync();

        var allActiveEmployees = await _db.Employees
            .Where(e => e.Status == Domain.Enums.EmploymentStatus.FullTimePermanent || e.Status == Domain.Enums.EmploymentStatus.FullTimeProbation || e.Status == Domain.Enums.EmploymentStatus.FullTimeContract)
            .Select(e => e.Id)
            .ToListAsync();

        var missing = allActiveEmployees.Except(employeesWithRecords).ToList();

        foreach (var empId in missing)
        {
            _db.Set<AttendanceRecord>().Add(new AttendanceRecord
            {
                EmployeeId = empId,
                Date = yesterday,
                Status = "Absent",
                Remarks = "Auto-generated: no punch record found",
                Source = "System"
            });
        }

        if (missing.Count > 0)
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Created {Count} absent records for {Date}", missing.Count, yesterday);
        }
        else
        {
            _logger.LogInformation("No missing attendance records for {Date}", yesterday);
        }
    }
}
