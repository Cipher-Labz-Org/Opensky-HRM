using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Appraisal : AuditableEntity
{
    /// NotStarted, SelfAssessment, ManagerReview, PeerReview, Calibration, Acknowledgement, Completed
    public string Status { get; set; } = "NotStarted";

    public decimal? FinalRating { get; set; }
    public string? FinalComments { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgementComment { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid CycleId { get; set; }
    public AppraisalCycle Cycle { get; set; } = null!;

    public ICollection<AppraisalReviewer> Reviewers { get; set; } = new List<AppraisalReviewer>();
}

public class AppraisalReviewer : AuditableEntity
{
    /// Self, Manager, Peer, DirectReport, External
    public string ReviewerType { get; set; } = "Self";
    public string Status { get; set; } = "Pending";
    public decimal? OverallRating { get; set; }
    public string? OverallComments { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public Guid AppraisalId { get; set; }
    public Appraisal Appraisal { get; set; } = null!;

    public Guid ReviewerEmployeeId { get; set; }
    public Employee ReviewerEmployee { get; set; } = null!;

    public ICollection<AppraisalResponseItem> ResponseItems { get; set; } = new List<AppraisalResponseItem>();
}

public class AppraisalResponseItem : AuditableEntity
{
    public int? RatingValue { get; set; }
    public string? Comment { get; set; }

    public Guid ReviewerId { get; set; }
    public AppraisalReviewer Reviewer { get; set; } = null!;

    public Guid TemplateSectionItemId { get; set; }
    public AppraisalTemplateSectionItem TemplateSectionItem { get; set; } = null!;
}
