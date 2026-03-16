using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeCompensation : AuditableEntity
{
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid ComponentId { get; set; }
    public CompensationComponent Component { get; set; } = null!;
}
