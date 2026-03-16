using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LeavePolicy : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxDaysPerYear { get; set; }
    public bool AllowCarryForward { get; set; }
    public int MaxCarryForwardDays { get; set; }
    public bool AllowEncashment { get; set; }
    public bool RequiresApproval { get; set; } = true;

    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
}
