using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ApprovalWorkflow : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Steps { get; set; } = 1;
    public bool IsActive { get; set; } = true;
}
