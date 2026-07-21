using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AiConversation : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string Title { get; set; } = "New conversation";
    public ICollection<AiMessage> Messages { get; set; } = new List<AiMessage>();
}
