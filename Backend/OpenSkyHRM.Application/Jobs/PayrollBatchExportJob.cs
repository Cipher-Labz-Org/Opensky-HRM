using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Jobs;

public class PayrollBatchExportJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<PayrollBatchExportJob> _logger;

    public PayrollBatchExportJob(AppDbContext db, ILogger<PayrollBatchExportJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        _logger.LogInformation("Running payroll batch export job...");

        var pendingBatches = await _db.PayrollBatches
            .Where(b => b.Status == "Approved")
            .ToListAsync();

        foreach (var batch in pendingBatches)
        {
            batch.Status = "Exported";
            batch.ProcessedAt = DateTime.UtcNow;
            _logger.LogInformation("Exported payroll batch {BatchCode} for {Month}/{Year}",
                batch.BatchCode, batch.Month, batch.Year);
        }

        if (pendingBatches.Count > 0)
            await _db.SaveChangesAsync();

        _logger.LogInformation("Payroll batch export completed. {Count} batches processed.", pendingBatches.Count);
    }
}
