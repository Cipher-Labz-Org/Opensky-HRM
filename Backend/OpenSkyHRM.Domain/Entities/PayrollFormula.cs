using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class PayrollFormula : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public Guid ComponentId { get; set; }
    public string Expression { get; set; } = string.Empty;
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public bool IsActive { get; set; } = true;

    public CompensationComponent Component { get; set; } = null!;
}
