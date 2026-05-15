using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

public class EmployeeBirthdayDigestReminderJob
{
    private readonly IEmployeeBirthdayDigestReminderService _svc;
    private readonly ILogger<EmployeeBirthdayDigestReminderJob> _logger;

    public EmployeeBirthdayDigestReminderJob(
        IEmployeeBirthdayDigestReminderService svc,
        ILogger<EmployeeBirthdayDigestReminderJob> logger)
    {
        _svc = svc;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var n = await _svc.ProcessForUtcDateAsync(DateTime.UtcNow, cancellationToken);
        _logger.LogInformation("Employee birthday digest notifications created: {Count} at {Time:u}", n,
            DateTime.UtcNow);
    }
}
