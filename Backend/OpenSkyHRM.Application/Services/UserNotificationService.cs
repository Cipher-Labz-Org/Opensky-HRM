using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Notifications;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class UserNotificationService : IUserNotificationService
{
    private readonly AppDbContext _db;

    public UserNotificationService(AppDbContext db) => _db = db;

    public async Task<UserNotificationInboxDto> GetInboxAsync(Guid userId, int take,
        CancellationToken cancellationToken = default)
    {
        take = Math.Clamp(take, 1, 100);
        var unread = await _db.UserNotifications.AsNoTracking()
            .CountAsync(
                n => n.UserId == userId && n.ReadAt == null && n.Category != "BirthdayWishMyReply",
                cancellationToken);

        var rows = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == userId && n.Category != "BirthdayWishMyReply")
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new
            {
                n.Id,
                n.Title,
                n.Body,
                n.Category,
                n.CreatedAt,
                n.ReadAt,
                n.SourceUserId,
                n.DedupeKey,
            })
            .ToListAsync(cancellationToken);

        var items = rows.Select(n => new UserNotificationListItemDto(
                n.Id,
                n.Title,
                n.Body,
                n.Category,
                n.CreatedAt,
                n.ReadAt,
                ResolveBirthdayWishSenderUserId(n.Category, n.SourceUserId, n.DedupeKey)))
            .ToList();

        return new UserNotificationInboxDto(items, unread);
    }

    public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _db.UserNotifications.AsNoTracking()
            .CountAsync(
                n => n.UserId == userId && n.ReadAt == null && n.Category != "BirthdayWishMyReply",
                cancellationToken);

    public async Task<bool> MarkReadAsync(Guid userId, Guid notificationId,
        CancellationToken cancellationToken = default)
    {
        var n = await _db.UserNotifications.FirstOrDefaultAsync(
            x => x.Id == notificationId && x.UserId == userId, cancellationToken);
        if (n is null)
            return false;
        if (n.ReadAt is null)
        {
            n.ReadAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    public async Task<bool> TryCreateDedupedAsync(
        Guid userId,
        string dedupeKey,
        string title,
        string body,
        string category,
        Guid? relatedEmployeeAttachmentId,
        Guid? sourceUserId = null,
        CancellationToken cancellationToken = default)
    {
        if (await _db.UserNotifications.AnyAsync(n => n.DedupeKey == dedupeKey, cancellationToken))
            return false;

        _db.UserNotifications.Add(new UserNotification
        {
            UserId = userId,
            Title = title.Trim(),
            Body = body.Trim(),
            Category = category.Trim(),
            DedupeKey = dedupeKey,
            RelatedEmployeeAttachmentId = relatedEmployeeAttachmentId,
            SourceUserId = sourceUserId,
        });
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<BirthdayWishReplyResult> ReplyToBirthdayWishAsync(
        Guid recipientUserId,
        Guid wishNotificationId,
        string message,
        CancellationToken cancellationToken = default)
    {
        var msg = (message ?? "").Trim();
        if (msg.Length == 0)
            return new BirthdayWishReplyResult(false, "empty");
        if (msg.Length > 500)
            msg = msg.Substring(0, 500);

        var wish = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.Id == wishNotificationId && n.UserId == recipientUserId)
            .Select(n => new { n.Category, n.SourceUserId, n.DedupeKey })
            .FirstOrDefaultAsync(cancellationToken);
        if (wish is null)
            return new BirthdayWishReplyResult(false, "notFound");
        if (!string.Equals(wish.Category, "BirthdayWish", StringComparison.Ordinal))
            return new BirthdayWishReplyResult(false, "notBirthdayWish");

        var senderUserId = ResolveBirthdayWishSenderUserId(wish.Category, wish.SourceUserId, wish.DedupeKey);
        if (!senderUserId.HasValue)
            return new BirthdayWishReplyResult(false, "noReplyTarget");

        if (senderUserId == recipientUserId)
            return new BirthdayWishReplyResult(false, "invalidRecipient");

        var senderActive = await _db.Users.AsNoTracking()
            .AnyAsync(u => u.Id == senderUserId.Value && u.IsActive && !u.IsDeleted, cancellationToken);
        if (!senderActive)
            return new BirthdayWishReplyResult(false, "senderInactive");

        var replier = await _db.Users.AsNoTracking()
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == recipientUserId, cancellationToken);
        if (replier is null)
            return new BirthdayWishReplyResult(false, "replierMissing");

        var replierName = replier.Employee != null
            ? FormatEmployeeDisplayName(replier.Employee)
            : (replier.Username.Trim().Length > 0 ? replier.Username.Trim() : "Someone");

        const string title = "Birthday wish reply";
        var body = $"{replierName} replied to your birthday wish:\n\n{msg}";
        const string category = "BirthdayWishReply";
        var dedupe = $"BD-WISH-REPLY:{wishNotificationId:D}:{Guid.NewGuid():N}";

        _db.UserNotifications.Add(new UserNotification
        {
            UserId = senderUserId.Value,
            Title = title,
            Body = body,
            Category = category,
            DedupeKey = dedupe,
            SourceUserId = recipientUserId,
        });

        _db.UserNotifications.Add(new UserNotification
        {
            UserId = recipientUserId,
            Title = "You replied",
            Body = msg,
            Category = "BirthdayWishMyReply",
            DedupeKey = $"BD-WISH-MYREPLY:{wishNotificationId:D}:{Guid.NewGuid():N}",
            SourceUserId = senderUserId.Value,
            ReadAt = DateTime.UtcNow,
        });

        await _db.SaveChangesAsync(cancellationToken);
        return new BirthdayWishReplyResult(true, null);
    }

    public async Task<BirthdayWishThreadDto?> GetBirthdayWishThreadAsync(
        Guid recipientUserId,
        Guid wishNotificationId,
        CancellationToken cancellationToken = default)
    {
        var wish = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.Id == wishNotificationId && n.UserId == recipientUserId && n.Category == "BirthdayWish")
            .Select(n => new { n.Id, n.Title, n.Body, n.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (wish is null)
            return null;

        var prefix = $"BD-WISH-MYREPLY:{wish.Id:D}:";
        var myReplies = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == recipientUserId && n.Category == "BirthdayWishMyReply" && n.DedupeKey.StartsWith(prefix))
            .OrderBy(n => n.CreatedAt)
            .Select(n => new { n.Body, n.CreatedAt })
            .ToListAsync(cancellationToken);

        var messages = new List<BirthdayWishThreadMessageDto> { new(true, wish.Body, wish.CreatedAt) };
        messages.AddRange(myReplies.Select(r => new BirthdayWishThreadMessageDto(false, r.Body, r.CreatedAt)));

        return new BirthdayWishThreadDto(wish.Id, wish.Title, messages);
    }

    private static string FormatEmployeeDisplayName(Employee emp) =>
        string.IsNullOrWhiteSpace(emp.MiddleName)
            ? $"{emp.FirstName} {emp.LastName}".Trim()
            : $"{emp.FirstName} {emp.MiddleName} {emp.LastName}".Trim();

    /// <summary>Wishes created before <see cref="UserNotification.SourceUserId"/> existed still encode the sender in <see cref="UserNotification.DedupeKey"/> as <c>BD-WISH:{yyyyMMdd}:{senderUserId}:…</c>.</summary>
    private static Guid? ResolveBirthdayWishSenderUserId(string category, Guid? sourceUserId, string dedupeKey)
    {
        if (sourceUserId.HasValue)
            return sourceUserId;
        return TryGetBirthdayWishSenderUserIdFromDedupe(category, dedupeKey);
    }

    private static Guid? TryGetBirthdayWishSenderUserIdFromDedupe(string category, string dedupeKey)
    {
        if (!string.Equals(category, "BirthdayWish", StringComparison.Ordinal))
            return null;
        if (string.IsNullOrEmpty(dedupeKey) || !dedupeKey.StartsWith("BD-WISH:", StringComparison.Ordinal))
            return null;
        var parts = dedupeKey.Split(':');
        // BD-WISH:{runDate}:{fromUserId}:{toEmployeeId}:{recipientUserId}
        if (parts.Length < 5)
            return null;
        return Guid.TryParse(parts[2], out var senderId) ? senderId : null;
    }
}
