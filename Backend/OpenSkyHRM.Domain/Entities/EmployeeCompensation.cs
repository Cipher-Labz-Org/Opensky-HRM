using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeCompensation : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Guid ComponentId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public Guid? BatchId { get; set; }

    public Employee Employee { get; set; } = null!;
    public CompensationComponent Component { get; set; } = null!;
    public PayrollBatch? Batch { get; set; }
}
