namespace OpenSkyHRM.Application.DTOs.Notifications;

public sealed record UserNotificationListItemDto(
    Guid Id,
    string Title,
    string Body,
    string Category,
    DateTime CreatedAt,
    DateTime? ReadAt,
    Guid? SourceUserId);

public sealed record UserNotificationInboxDto(
    IReadOnlyList<UserNotificationListItemDto> Items,
    int UnreadCount);

public sealed record BirthdayWishReplyResult(bool Sent, string? Reason);

/// <summary>One line in the birthday-wish chat (recipient view).</summary>
public sealed record BirthdayWishThreadMessageDto(bool FromWisher, string Body, DateTime CreatedAt);

/// <summary>Wish + your replies for the birthday employee (chat-style UI).</summary>
public sealed record BirthdayWishThreadDto(Guid WishNotificationId, string WishTitle, IReadOnlyList<BirthdayWishThreadMessageDto> Messages);
