using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AiToolAuditLog : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public string ToolName { get; set; } = string.Empty;
    public string ArgsRedactedJson { get; set; } = "{}";
    public string ResultSummary { get; set; } = string.Empty;
}
