using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class AppraisalCycle : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CycleType { get; set; } = "Annual";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    /// Draft, Active, SelfAssessment, ManagerReview, PeerReview, Calibration, Acknowledgement, Completed
    public string Phase { get; set; } = "Draft";

    public bool IncludeSelfAssessment { get; set; } = true;
    public bool IncludeManagerReview { get; set; } = true;
    public bool IncludePeerReview { get; set; }
    public bool IncludeDirectReportReview { get; set; }
    public bool IncludeExternalReview { get; set; }
    public bool IncludeGoals { get; set; } = true;

    public int SelfWeight { get; set; } = 10;
    public int ManagerWeight { get; set; } = 40;
    public int PeerWeight { get; set; } = 25;
    public int DirectReportWeight { get; set; } = 15;
    public int ExternalWeight { get; set; } = 10;

    public DateTime? SelfDeadline { get; set; }
    public DateTime? ManagerDeadline { get; set; }
    public DateTime? PeerDeadline { get; set; }
    public DateTime? CompletionDeadline { get; set; }

    public Guid TemplateId { get; set; }
    public AppraisalTemplate Template { get; set; } = null!;

    public ICollection<Appraisal> Appraisals { get; set; } = new List<Appraisal>();
}
