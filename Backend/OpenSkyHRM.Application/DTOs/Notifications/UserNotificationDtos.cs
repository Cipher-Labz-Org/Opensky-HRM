namespace OpenSkyHRM.Application.DTOs.Notifications;

public sealed record UserNotificationListItemDto(
    Guid Id,
    string Title,
    string Body,
    string Category,
    DateTime CreatedAt,
    DateTime? ReadAt);

public sealed record UserNotificationInboxDto(
    IReadOnlyList<UserNotificationListItemDto> Items,
    int UnreadCount);
