namespace OpenSkyHRM.Application.DTOs.Organization;

public class PeopleAuditChangeRowDto
{
    public string Field { get; set; } = string.Empty;
    public string? Previous { get; set; }
    public string? Current { get; set; }
}

public class PeopleAuditLogEntryDto
{
    public Guid Id { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public Guid? SubjectEmployeeId { get; set; }
    /// <summary>Resolved employee display (code · name).</summary>
    public string? SubjectEmployeeLabel { get; set; }
    public string? UserId { get; set; }
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    /// <summary>Human-readable before/after rows (IDs resolved to names where possible).</summary>
    public IReadOnlyList<PeopleAuditChangeRowDto>? Changes { get; set; }
}
