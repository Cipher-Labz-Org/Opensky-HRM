using System.Globalization;
using System.Text.Json;
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
        await PruneStaleBirthdayRemindersAsync(userId, cancellationToken);
        await PruneExpiredBirthdayWishHistoryAsync(userId, cancellationToken);

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

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await PruneStaleBirthdayRemindersAsync(userId, cancellationToken);
        await PruneExpiredBirthdayWishHistoryAsync(userId, cancellationToken);
        return await _db.UserNotifications.AsNoTracking()
            .CountAsync(
                n => n.UserId == userId && n.ReadAt == null && n.Category != "BirthdayWishMyReply",
                cancellationToken);
    }

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
            if (string.Equals(n.Category, "BirthdayWish", StringComparison.Ordinal))
                await MarkLinkedBirthdayWishSentReadAsync(n.DedupeKey, cancellationToken);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    /// <summary>
    /// When the birthday recipient reads a wish, mark the sender's matching BirthdayWishSent confirmation as read too.
    /// Dedupe keys: wish <c>BD-WISH:{runDate}:{senderUserId}:{toEmployeeId}:{recipientUserId}</c>,
    /// sent <c>BD-WISH-SENT:{runDate}:{senderUserId}:{toEmployeeId}</c>.
    /// </summary>
    private async Task MarkLinkedBirthdayWishSentReadAsync(string? wishDedupeKey, CancellationToken cancellationToken)
    {
        if (!TryParseBirthdayWishDedupe(wishDedupeKey, out var runDate, out var senderUserId, out var toEmployeeId))
            return;

        var sentDedupe = $"BD-WISH-SENT:{runDate}:{senderUserId:D}:{toEmployeeId:D}";
        var sentPrefix = sentDedupe + ":";
        var sentNotices = await _db.UserNotifications
            .Where(n => n.UserId == senderUserId
                        && n.Category == "BirthdayWishSent"
                        && (n.DedupeKey == sentDedupe || n.DedupeKey.StartsWith(sentPrefix)))
            .ToListAsync(cancellationToken);
        var readAt = DateTime.UtcNow;
        foreach (var sentNotice in sentNotices.Where(n => n.ReadAt == null))
            sentNotice.ReadAt = readAt;
    }

    private static bool TryParseBirthdayWishDedupe(
        string? dedupeKey,
        out string runDate,
        out Guid senderUserId,
        out Guid toEmployeeId)
    {
        runDate = "";
        senderUserId = Guid.Empty;
        toEmployeeId = Guid.Empty;
        if (string.IsNullOrEmpty(dedupeKey)
            || !dedupeKey.StartsWith("BD-WISH:", StringComparison.Ordinal)
            || dedupeKey.StartsWith("BD-WISH-SENT:", StringComparison.Ordinal))
            return false;

        var rest = dedupeKey["BD-WISH:".Length..];
        var dateEnd = rest.IndexOf(':');
        if (dateEnd <= 0)
            return false;
        runDate = rest[..dateEnd];
        rest = rest[(dateEnd + 1)..];

        if (!TryConsumeGuidPrefix(ref rest, out senderUserId))
            return false;
        return TryConsumeGuidPrefix(ref rest, out toEmployeeId);
    }

    private static bool TryConsumeGuidPrefix(ref string rest, out Guid guid)
    {
        guid = Guid.Empty;
        rest = rest.TrimStart(':');
        if (rest.Length < 36)
            return false;
        var segment = rest[..36];
        if (!Guid.TryParse(segment, out guid))
            return false;
        rest = rest.Length > 36 ? rest[36..].TrimStart(':') : "";
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

    /// <summary>
    /// Removes birthday digest reminders whose occasion date is no longer "today" / within the 7-day upcoming window (UTC),
    /// so they disappear after the day passes without waiting for the next Hangfire rebuild.
    /// </summary>
    private async Task PruneStaleBirthdayRemindersAsync(Guid userId, CancellationToken cancellationToken)
    {
        var utcToday = DateTime.UtcNow.Date;
        var todayD = DateOnly.FromDateTime(utcToday);
        var tomorrowD = DateOnly.FromDateTime(utcToday.AddDays(1));
        var lastUpcomingD = DateOnly.FromDateTime(utcToday.AddDays(7));

        var catToday = EmployeeBirthdayDigestReminderService.CategoryBirthdayToday;
        var catUp = EmployeeBirthdayDigestReminderService.CategoryBirthdayUpcoming;

        var candidates = await _db.UserNotifications
            .Where(n => n.UserId == userId && (n.Category == catToday || n.Category == catUp))
            .ToListAsync(cancellationToken);

        if (candidates.Count == 0)
            return;

        var removed = false;
        foreach (var n in candidates)
        {
            if (!TryParseBirthdayReminderIsoDate(n.Body, out var occasion))
                continue;
            var stale =
                (string.Equals(n.Category, catToday, StringComparison.Ordinal) && occasion != todayD)
                || (string.Equals(n.Category, catUp, StringComparison.Ordinal)
                    && (occasion < tomorrowD || occasion > lastUpcomingD));
            if (!stale)
                continue;
            _db.UserNotifications.Remove(n);
            removed = true;
        }

        if (removed)
            await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Removes sender wish-history and consumed recipient wishes from prior calendar months (UTC),
    /// so entries disappear after month end per product rules.
    /// </summary>
    private async Task PruneExpiredBirthdayWishHistoryAsync(Guid userId, CancellationToken cancellationToken)
    {
        var utcNow = DateTime.UtcNow;
        var currentYear = utcNow.Year;
        var currentMonth = utcNow.Month;

        var candidates = await _db.UserNotifications
            .Where(n => n.UserId == userId
                        && (n.Category == "BirthdayWishSent"
                            || (n.Category == "BirthdayWish" && n.ReadAt != null)))
            .ToListAsync(cancellationToken);

        if (candidates.Count == 0)
            return;

        var removed = false;
        foreach (var n in candidates)
        {
            var created = n.CreatedAt;
            if (created.Year > currentYear)
                continue;
            if (created.Year == currentYear && created.Month >= currentMonth)
                continue;
            _db.UserNotifications.Remove(n);
            removed = true;
        }

        if (removed)
            await _db.SaveChangesAsync(cancellationToken);
    }

    private static bool TryParseBirthdayReminderIsoDate(string? body, out DateOnly occasion)
    {
        occasion = default;
        if (string.IsNullOrWhiteSpace(body))
            return false;
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (!doc.RootElement.TryGetProperty("isoDate", out var el))
                return false;
            var s = el.GetString();
            if (string.IsNullOrEmpty(s))
                return false;
            return DateOnly.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out occasion);
        }
        catch
        {
            return false;
        }
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
        return TryParseBirthdayWishDedupe(dedupeKey, out _, out var senderUserId, out _)
            ? senderUserId
            : null;
    }
}
