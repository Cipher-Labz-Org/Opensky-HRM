using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class InstanceModuleEntitlement : AuditableEntity
{
    public Guid InstanceSubscriptionId { get; set; }
    public InstanceSubscription InstanceSubscription { get; set; } = null!;

    public Guid LicensedModuleId { get; set; }
    public LicensedModule LicensedModule { get; set; } = null!;

    public bool IsEnabled { get; set; } = true;
}
