using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Candidate : AuditableEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ResumeUrl { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Stage { get; set; } = "Sourced";
    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;
    public string? CurrentTitle { get; set; }
    public string? CurrentCompany { get; set; }
    public decimal? ExpectedSalary { get; set; }
    public string? NoticePeriod { get; set; }
    public string? Notes { get; set; }
    public int? Rating { get; set; }
    public string? RejectionReason { get; set; }
    public string? Tags { get; set; }

    public Guid RequisitionId { get; set; }
    public Requisition Requisition { get; set; } = null!;

    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public ICollection<Interview> Interviews { get; set; } = new List<Interview>();
    public ICollection<CandidateActivity> Activities { get; set; } = new List<CandidateActivity>();
    public Offer? Offer { get; set; }

    public string FullName => $"{FirstName} {LastName}";
}
