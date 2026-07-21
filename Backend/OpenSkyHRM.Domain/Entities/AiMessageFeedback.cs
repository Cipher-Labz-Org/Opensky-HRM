using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AiMessageFeedback : BaseEntity
{
    public Guid MessageId { get; set; }
    public AiMessage Message { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>+1 or -1</summary>
    public int Rating { get; set; }
}
