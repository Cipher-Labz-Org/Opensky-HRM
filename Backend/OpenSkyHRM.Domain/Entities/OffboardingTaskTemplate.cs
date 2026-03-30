using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class OffboardingTaskTemplate : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }
}
