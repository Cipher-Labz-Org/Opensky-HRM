using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class LeaveRequest : AuditableEntity
{
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string? Reason { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? ApproverRemarks { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? CoveragePerson { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid LeaveTypeId { get; set; }
    public LeaveType LeaveType { get; set; } = null!;

    public Guid? ApproverId { get; set; }
    public Employee? Approver { get; set; }
}
