using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class PerformanceReview : AuditableEntity
{
    public decimal? OverallRating { get; set; }
    public string? SelfAssessment { get; set; }
    public string? ManagerAssessment { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public DateTime? CompletedAt { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid ReviewCycleId { get; set; }
    public ReviewCycle ReviewCycle { get; set; } = null!;

    public Guid? ReviewerId { get; set; }
    public Employee? Reviewer { get; set; }
}
