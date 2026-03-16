using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class OnboardingMilestone : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DayNumber { get; set; }
    public string? Category { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CompletedAt { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
}
