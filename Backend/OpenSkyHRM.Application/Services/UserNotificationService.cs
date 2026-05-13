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
            .CountAsync(n => n.UserId == userId && n.ReadAt == null, cancellationToken);

        var items = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(take)
            .Select(n => new UserNotificationListItemDto(
                n.Id,
                n.Title,
                n.Body,
                n.Category,
                n.CreatedAt,
                n.ReadAt))
            .ToListAsync(cancellationToken);

        return new UserNotificationInboxDto(items, unread);
    }

    public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _db.UserNotifications.AsNoTracking()
            .CountAsync(n => n.UserId == userId && n.ReadAt == null, cancellationToken);

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
        });
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
