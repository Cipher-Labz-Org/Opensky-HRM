using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/notifications")]
public class NotificationsController : ControllerBase
{
    private readonly IUserNotificationService _notifications;

    public NotificationsController(IUserNotificationService notifications) => _notifications = notifications;

    [HttpGet]
    public async Task<IActionResult> GetInbox([FromQuery] int take = 30, CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();
        var inbox = await _notifications.GetInboxAsync(userId.Value, take, cancellationToken);
        return Ok(inbox);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();
        var n = await _notifications.GetUnreadCountAsync(userId.Value, cancellationToken);
        return Ok(new { unreadCount = n });
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();
        var ok = await _notifications.MarkReadAsync(userId.Value, id, cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
