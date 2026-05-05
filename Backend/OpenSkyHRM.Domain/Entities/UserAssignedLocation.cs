using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// When a user has one or more rows, People (and related) access is limited to employees at those locations.
/// No rows = no location restriction (subject to RBAC scope only).
/// </summary>
public class UserAssignedLocation : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid LocationId { get; set; }
    public Location Location { get; set; } = null!;
}
