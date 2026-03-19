using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveEntitlementRule : AuditableEntity
{
    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
    public string RuleType { get; set; } = "ServiceYearBased";
    public string RuleConfig { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
}
