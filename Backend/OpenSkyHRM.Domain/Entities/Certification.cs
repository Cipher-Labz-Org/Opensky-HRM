using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Certification : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? IssuingBody { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
