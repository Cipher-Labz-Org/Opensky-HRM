using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// When present, People access is limited to employees in these business units (combined with other scope rows).
/// </summary>
public class UserAssignedBusinessUnit : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid BusinessUnitId { get; set; }
    public BusinessUnit BusinessUnit { get; set; } = null!;
}
