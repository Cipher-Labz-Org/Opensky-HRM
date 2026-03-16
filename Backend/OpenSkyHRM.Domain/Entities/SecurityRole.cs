using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class SecurityRole : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsSystemRole { get; set; }

    public ICollection<Permission> Permissions { get; set; } = new List<Permission>();
}
