using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class OnboardingTask : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int SortOrder { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
    public User? AssignedToUser { get; set; }
}
