using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

public class TrainingDueReminderJob
{
    private readonly ITrainingAssignmentService _training;
    private readonly ILogger<TrainingDueReminderJob> _logger;

    public TrainingDueReminderJob(ITrainingAssignmentService training, ILogger<TrainingDueReminderJob> logger)
    {
        _training = training;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var n = await _training.SendOverdueRemindersAsync(cancellationToken);
        _logger.LogInformation("Training overdue reminders sent: {Count} at {Time:u}", n, DateTime.UtcNow);
    }
}
