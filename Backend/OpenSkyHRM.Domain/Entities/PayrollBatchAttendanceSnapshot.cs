using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Per-employee attendance/leave values imported into a payroll batch for OT and no-pay calculation.
/// </summary>
public class PayrollBatchAttendanceSnapshot : BaseEntity
{
    public Guid BatchId { get; set; }
    public PayrollBatch Batch { get; set; } = null!;

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public decimal ApprovedOtHours { get; set; }
    public decimal OtAmount { get; set; }
    public int AttendanceNopayDays { get; set; }
    public int LeaveNopayDays { get; set; }
    public int TotalNopayDays { get; set; }
    public decimal PoyaDaysWorked { get; set; }
    public bool OtApproved { get; set; }
    public bool OtOutdated { get; set; }
    public DateTime ImportedAt { get; set; }
}
