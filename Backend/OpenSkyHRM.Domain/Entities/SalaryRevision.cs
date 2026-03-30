using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class SalaryRevision : AuditableEntity
{
    public string RevisionType { get; set; } = "Increment";
    public decimal CurrentSalary { get; set; }
    public decimal ProposedSalary { get; set; }
    public decimal ChangePercentage { get; set; }
    public string? Justification { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public DateTime EffectiveDate { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? Remarks { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
}
