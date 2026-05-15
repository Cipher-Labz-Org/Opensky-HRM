using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class SalaryAdvanceRequest : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Guid PayrollBatchId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public SalaryAdvanceRequestStatus Status { get; set; } = SalaryAdvanceRequestStatus.Pending;
    /// <summary>Optional note from the employee when submitting.</summary>
    public string? Remarks { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? RejectionReason { get; set; }

    public Employee Employee { get; set; } = null!;
    public PayrollBatch PayrollBatch { get; set; } = null!;
}
