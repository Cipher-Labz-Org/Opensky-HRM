using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

public sealed class BirthdayWishReplyRequestDto
{
    public string Message { get; set; } = "";
}

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

    /// <summary>Wish + your replies for chat UI (birthday employee owns the wish notification).</summary>
    [HttpGet("birthday-wish/{wishNotificationId:guid}/thread")]
    public async Task<IActionResult> GetBirthdayWishThread(
        Guid wishNotificationId,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();
        var thread = await _notifications.GetBirthdayWishThreadAsync(userId.Value, wishNotificationId, cancellationToken);
        return thread is null ? NotFound() : Ok(thread);
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

    /// <summary>Reply to a BirthdayWish in-app notification; notifies the original sender.</summary>
    [HttpPost("{id:guid}/birthday-wish-reply")]
    public async Task<IActionResult> ReplyToBirthdayWish(
        Guid id,
        [FromBody] BirthdayWishReplyRequestDto dto,
        CancellationToken cancellationToken = default)
    {
        var userId = GetUserId();
        if (userId is null)
            return Unauthorized();
        var res = await _notifications.ReplyToBirthdayWishAsync(userId.Value, id, dto.Message ?? "", cancellationToken);
        if (res.Sent)
            return Ok(new { sent = true });
        return res.Reason switch
        {
            "notFound" => NotFound(),
            "empty" => BadRequest(new { message = "Message is required." }),
            "notBirthdayWish" or "noReplyTarget" or "invalidRecipient" =>
                BadRequest(new { message = "This notification cannot be replied to." }),
            "senderInactive" => BadRequest(new { message = "The sender is no longer active." }),
            _ => BadRequest(new { message = "Could not send reply." }),
        };
    }

    private Guid? GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : null;
    }
}
