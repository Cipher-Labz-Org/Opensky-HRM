using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Jobs;

/// <summary>Applies saved punch corrections in the background and keeps the last report.</summary>
public class BiometricPunchRepairJob
{
    public const string LastReportKey = "biometric.punchRepair.lastReport";

    private readonly AppDbContext _db;
    private readonly BiometricPunchTimeRepairService _repair;
    private readonly ILogger<BiometricPunchRepairJob> _logger;

    public BiometricPunchRepairJob(
        AppDbContext db,
        BiometricPunchTimeRepairService repair,
        ILogger<BiometricPunchRepairJob> logger)
    {
        _db = db;
        _repair = repair;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        await SaveReportAsync(new { status = "running", startedAtUtc = DateTime.UtcNow }, cancellationToken);

        Application.DTOs.TimeAttendance.PunchTimeRepairReportDto report;
        try
        {
            report = await _repair.RunAsync(dryRun: false, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Fingerprint punch repair failed");
            await SaveReportAsync(new { status = "failed", failedAtUtc = DateTime.UtcNow, error = ex.Message }, cancellationToken);
            throw;
        }
        report.Samples = report.Samples.Take(20).ToList();

        _logger.LogInformation(
            "Fingerprint punch repair: {Corrected} corrected, {Duplicates} duplicates removed, {Inserted} inserted, {Days} attendance days rebuilt",
            report.PunchesCorrected,
            report.DuplicatesRemoved,
            report.PunchesInserted,
            report.AttendanceDaysRebuilt);

        await SaveReportAsync(new { status = "done", finishedAtUtc = DateTime.UtcNow, report }, cancellationToken);
    }

    private async Task SaveReportAsync(object value, CancellationToken cancellationToken)
    {
        _db.ChangeTracker.Clear();
        var json = JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == LastReportKey, cancellationToken);
        if (setting is null)
        {
            _db.SystemSettings.Add(new SystemSetting
            {
                Key = LastReportKey,
                Value = json,
                Description = "Result of the last fingerprint punch repair run.",
            });
        }
        else
        {
            setting.Value = json;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }
}
