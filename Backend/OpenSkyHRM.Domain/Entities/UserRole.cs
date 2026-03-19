using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class UserRole : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public Guid RoleId { get; set; }
    public SecurityRole Role { get; set; } = null!;
}
