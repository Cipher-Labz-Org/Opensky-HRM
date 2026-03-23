using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeTaskTemplateItem : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public string AssignmentType { get; set; } = "User"; // "User" or "Supervisor"
    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }

    public Guid TemplateId { get; set; }
    public EmployeeTaskTemplate Template { get; set; } = null!;
}
