namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Tracks monthly leave accruals to prevent double-accrual when the job runs.
/// Unique per (EmployeeId, LeaveTypeId, Year, Month).
/// </summary>
public class LeaveMonthlyAccrual
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    public decimal Amount { get; set; }
    public DateTime AccruedAt { get; set; } = DateTime.UtcNow;

    public Employee Employee { get; set; } = null!;
    public LeaveType LeaveType { get; set; } = null!;
}
