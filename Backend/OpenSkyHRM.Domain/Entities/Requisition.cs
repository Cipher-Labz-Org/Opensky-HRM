using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class Requisition : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; } = 1;
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public string? EmploymentType { get; set; }
    public int? ExperienceMin { get; set; }
    public int? ExperienceMax { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? Skills { get; set; }
    public DateTime? ClosedAt { get; set; }

    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public Guid? JobTitleId { get; set; }
    public JobTitle? JobTitle { get; set; }

    public Guid? HiringManagerId { get; set; }
    public Employee? HiringManager { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public Guid? PositionId { get; set; }
    public Position? Position { get; set; }

    public ICollection<Candidate> Candidates { get; set; } = new List<Candidate>();
}
