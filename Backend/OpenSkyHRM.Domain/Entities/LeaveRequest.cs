using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveRequest : AuditableEntity
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalDays { get; set; }
    /// <summary>FullDay, HalfDay, or ShortLeave.</summary>
    public string DurationKind { get; set; } = "FullDay";
    /// <summary>Morning or Afternoon when DurationKind is HalfDay.</summary>
    public string? HalfDayPeriod { get; set; }
    /// <summary>Hours taken when DurationKind is ShortLeave. Supports part hours, e.g. 1.5.</summary>
    public decimal? ShortLeaveHours { get; set; }
    public string? Reason { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? CoveragePerson { get; set; }

    /// <summary>Optional PDF medical certificate path under wwwroot (e.g. /uploads/leave-certificates/...).</summary>
    public string? MedicalCertificateUrl { get; set; }

    public int CurrentApprovalLevel { get; set; } = 1;

    // Level 1 approval
    public Guid? Level1ApproverId { get; set; }
    public string? Level1Remarks { get; set; }
    public DateTime? Level1ApprovedAt { get; set; }

    // Level 2 approval
    public Guid? Level2ApproverId { get; set; }
    public string? Level2Remarks { get; set; }
    public DateTime? Level2ApprovedAt { get; set; }

    // Legacy fields kept for backward compat
    public Guid? ApproverId { get; set; }
    public string? ApproverRemarks { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;

    public Employee? Approver { get; set; }
    public Employee? Level1Approver { get; set; }
    public Employee? Level2Approver { get; set; }
}
