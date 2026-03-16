using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class CompensationComponent : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Type { get; set; } = "Earning";
    public bool IsTaxable { get; set; }
    public bool IsStatutory { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
