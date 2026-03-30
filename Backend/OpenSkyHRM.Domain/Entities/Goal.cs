using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Goal : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public decimal Progress { get; set; }
    public string Status { get; set; } = "Not Started";
    public DateTime? DueDate { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid? ReviewCycleId { get; set; }
    public ReviewCycle? ReviewCycle { get; set; }

    public Guid? AppraisalCycleId { get; set; }
    public AppraisalCycle? AppraisalCycle { get; set; }

    public int? SelfRating { get; set; }
    public int? ManagerRating { get; set; }
}
