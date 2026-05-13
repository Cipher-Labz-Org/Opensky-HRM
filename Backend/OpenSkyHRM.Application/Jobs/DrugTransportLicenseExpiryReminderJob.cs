using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

public class DrugTransportLicenseExpiryReminderJob
{
    private readonly IDrugTransportLicenseExpiryReminderService _reminders;
    private readonly ILogger<DrugTransportLicenseExpiryReminderJob> _logger;

    public DrugTransportLicenseExpiryReminderJob(
        IDrugTransportLicenseExpiryReminderService reminders,
        ILogger<DrugTransportLicenseExpiryReminderJob> logger)
    {
        _reminders = reminders;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var n = await _reminders.ProcessForUtcDateAsync(DateTime.UtcNow, cancellationToken);
        _logger.LogInformation("Drug transport license expiry reminders created: {Count} at {Time:u}", n,
            DateTime.UtcNow);
    }
}
