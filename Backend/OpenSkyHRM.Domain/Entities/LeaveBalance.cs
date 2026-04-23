using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveBalance : AuditableEntity
{
    public int Year { get; set; }
    /// <summary>When set, balance applies to this period; when null, period is calendar year (Jan 1 - Dec 31 of Year).</summary>
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public decimal Entitled { get; set; }
    public decimal Used { get; set; }
    public decimal CarriedForward { get; set; }
    public decimal BroughtForwardDays { get; set; }
    public decimal Remaining => Entitled + CarriedForward - Used;

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
}
