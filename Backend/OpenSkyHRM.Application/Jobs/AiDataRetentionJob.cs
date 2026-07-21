using Microsoft.Extensions.Logging;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Application.Jobs;

public class AiDataRetentionJob
{
    private readonly IAiDataRetentionService _retention;
    private readonly ILogger<AiDataRetentionJob> _logger;

    public AiDataRetentionJob(IAiDataRetentionService retention, ILogger<AiDataRetentionJob> logger)
    {
        _retention = retention;
        _logger = logger;
    }

    public async Task ExecuteAsync(CancellationToken cancellationToken = default)
    {
        var convs = await _retention.PurgeExpiredConversationsAsync(cancellationToken);
        var audits = await _retention.PurgeExpiredAuditLogsAsync(cancellationToken);
        _logger.LogInformation(
            "AI data retention: purged {Conversations} conversations, {AuditLogs} audit logs at {Time:u}",
            convs, audits, DateTime.UtcNow);
    }
}
