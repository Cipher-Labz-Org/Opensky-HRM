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
        Guid? sourceUserId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Recipient replies to a BirthdayWish notification; notifies the original sender.</summary>
    Task<BirthdayWishReplyResult> ReplyToBirthdayWishAsync(
        Guid recipientUserId,
        Guid wishNotificationId,
        string message,
        CancellationToken cancellationToken = default);

    /// <summary>Wish text + your sent replies (for chat UI on the birthday employee inbox).</summary>
    Task<BirthdayWishThreadDto?> GetBirthdayWishThreadAsync(
        Guid recipientUserId,
        Guid wishNotificationId,
        CancellationToken cancellationToken = default);
}
