using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Permission : AuditableEntity
{
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Scope { get; set; } = "Own";

    public Guid RoleId { get; set; }
    public SecurityRole Role { get; set; } = null!;
}
