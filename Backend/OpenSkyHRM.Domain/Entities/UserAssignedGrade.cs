using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// When present, People access is limited to employees on these grades / bands.
/// </summary>
public class UserAssignedGrade : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid GradeId { get; set; }
    public Grade Grade { get; set; } = null!;
}
