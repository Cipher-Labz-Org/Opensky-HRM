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
    /// <summary>Set when the row came from leave-balance Excel/CSV import so Recalculate does not replace it and the balances grid can list only imported employees.</summary>
    public bool IsImported { get; set; }
    public decimal Remaining
    {
        get
        {
            if (Entitled > 0 && CarriedForward > 0 && CarriedForward == Entitled - Used)
                return Entitled - Used;
            return Entitled + CarriedForward - Used;
        }
    }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;
}
