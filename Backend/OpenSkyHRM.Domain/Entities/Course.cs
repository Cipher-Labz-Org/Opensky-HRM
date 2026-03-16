using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Course : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Provider { get; set; }
    public int DurationHours { get; set; }
    public string? Category { get; set; }
    public bool IsMandatory { get; set; }
    public bool IsActive { get; set; } = true;
}
