using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class LicensedModule : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<InstanceModuleEntitlement> Entitlements { get; set; } = new List<InstanceModuleEntitlement>();
}
