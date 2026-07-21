using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AiMessage : BaseEntity
{
    public Guid ConversationId { get; set; }
    public AiConversation Conversation { get; set; } = null!;

    /// <summary>user | assistant | tool</summary>
    public string Role { get; set; } = "user";

    public string Content { get; set; } = string.Empty;

    /// <summary>Optional JSON metadata (tool calls, page context, suggestions).</summary>
    public string? MetadataJson { get; set; }
}
