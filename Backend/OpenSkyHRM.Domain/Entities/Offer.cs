using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class Offer : AuditableEntity
{
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; } = "LKR";
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? Remarks { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string? OfferLetterUrl { get; set; }
    /// <summary>Editable HTML offer letter shared with the candidate (email body).</summary>
    public string? LetterHtml { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }

    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    public Guid? PositionId { get; set; }
    public Position? Position { get; set; }

    public Guid? JobTitleId { get; set; }
    public JobTitle? JobTitle { get; set; }

    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }
}
