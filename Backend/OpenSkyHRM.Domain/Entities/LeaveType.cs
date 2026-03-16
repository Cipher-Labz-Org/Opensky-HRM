using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveType : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; } = true;
    public bool IsActive { get; set; } = true;

    public ICollection<LeavePolicy> Policies { get; set; } = new List<LeavePolicy>();
    public ICollection<LeaveRequest> Requests { get; set; } = new List<LeaveRequest>();
    public ICollection<LeaveBalance> Balances { get; set; } = new List<LeaveBalance>();
}
