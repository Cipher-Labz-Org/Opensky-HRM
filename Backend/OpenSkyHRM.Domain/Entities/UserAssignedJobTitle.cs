using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// When present, People access is limited to employees with these job catalog titles.
/// </summary>
public class UserAssignedJobTitle : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid JobTitleId { get; set; }
    public JobTitle JobTitle { get; set; } = null!;
}
