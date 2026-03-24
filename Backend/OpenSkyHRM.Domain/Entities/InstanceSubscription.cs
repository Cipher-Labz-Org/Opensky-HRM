using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Single subscription row per database instance (one customer per deployment).
/// </summary>
public class InstanceSubscription : AuditableEntity
{
    public const string DefaultInstanceKey = "default";

    /// <summary>Stable key; only one row should exist per database.</summary>
    public string InstanceKey { get; set; } = DefaultInstanceKey;

    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public string PlanName { get; set; } = "Full";
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow;
    public DateTime? ValidUntil { get; set; }
    public string? Notes { get; set; }
    public int? MaxEmployees { get; set; }

    public ICollection<InstanceModuleEntitlement> ModuleEntitlements { get; set; } = new List<InstanceModuleEntitlement>();
}
