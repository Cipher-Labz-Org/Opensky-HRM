namespace OpenSkyHRM.Application.Interfaces;

public interface IAiDataRetentionService
{
    Task<int> PurgeExpiredConversationsAsync(CancellationToken ct = default);
    Task<int> PurgeExpiredAuditLogsAsync(CancellationToken ct = default);
    Task DeleteAllUserDataAsync(Guid userId, CancellationToken ct = default);
    Task<object> ExportUserDataAsync(Guid userId, CancellationToken ct = default);
}
