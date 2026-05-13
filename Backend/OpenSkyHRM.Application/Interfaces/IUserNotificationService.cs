using OpenSkyHRM.Application.DTOs.Notifications;

namespace OpenSkyHRM.Application.Interfaces;

public interface IUserNotificationService
{
    Task<UserNotificationInboxDto> GetInboxAsync(Guid userId, int take, CancellationToken cancellationToken = default);

    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<bool> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken cancellationToken = default);

    /// <returns>True if a new row was inserted.</returns>
    Task<bool> TryCreateDedupedAsync(
        Guid userId,
        string dedupeKey,
        string title,
        string body,
        string category,
        Guid? relatedEmployeeAttachmentId,
        CancellationToken cancellationToken = default);
}
