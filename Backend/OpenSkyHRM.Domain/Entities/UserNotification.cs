using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>In-app notification for a single user (e.g. license reminders).</summary>
public class UserNotification : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;

    /// <summary>Stable key so recurring jobs do not create duplicates (e.g. per attachment + user + reminder kind).</summary>
    public string DedupeKey { get; set; } = string.Empty;

    public Guid? RelatedEmployeeAttachmentId { get; set; }
    public EmployeeAttachment? RelatedEmployeeAttachment { get; set; }

    /// <summary>For e.g. <see cref="Category"/> BirthdayWish: the user who sent the wish (recipient can reply).</summary>
    public Guid? SourceUserId { get; set; }
    public User? SourceUser { get; set; }

    public DateTime? ReadAt { get; set; }
}
