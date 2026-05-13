using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Records a manager decision on calculated OT hours for an employee over a date range (used by Approvals / payroll prep).
/// </summary>
public class OvertimeNopayPeriodApproval : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public DateTime PeriodFrom { get; set; }
    public DateTime PeriodTo { get; set; }

    public ApprovalStatus Status { get; set; } = ApprovalStatus.Approved;

    /// <summary>OT hours at the time of approval (rounded same as calculation).</summary>
    public decimal OvertimeHoursSnapshot { get; set; }

    public Guid? ApproverId { get; set; }
    public Employee? Approver { get; set; }
    public DateTime? ActionAt { get; set; }
    public string? Remarks { get; set; }
}
