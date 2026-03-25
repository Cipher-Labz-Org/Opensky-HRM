using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AuditLog : BaseEntity
{
    /// <summary>High-level area, e.g. "People" for People Hub profile/compensation changes.</summary>
    public string Module { get; set; } = string.Empty;

    /// <summary>Employee whose record was affected (for filtering the People Hub audit trail).</summary>
    public Guid? SubjectEmployeeId { get; set; }

    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
