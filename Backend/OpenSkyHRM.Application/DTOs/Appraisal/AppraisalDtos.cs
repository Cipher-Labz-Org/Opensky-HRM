namespace OpenSkyHRM.Application.DTOs.Appraisal;

// ── Rating Scale ──────────────────────────────────────────────

public class RatingScaleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; }
    public List<RatingScaleItemDto> Items { get; set; } = new();
}

public class RatingScaleItemDto
{
    public Guid Id { get; set; }
    public int Value { get; set; }
    public string Label { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
}

public class CreateRatingScaleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDefault { get; set; }
    public List<CreateRatingScaleItemDto> Items { get; set; } = new();
}

public class CreateRatingScaleItemDto
{
    public int Value { get; set; }
    public string Label { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Color { get; set; }
}

// ── Competency ────────────────────────────────────────────────

public class CompetencyCategoryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public List<CompetencyDto> Competencies { get; set; } = new();
}

public class CompetencyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public Guid CategoryId { get; set; }
    public string? CategoryName { get; set; }
}

public class CreateCompetencyCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class CreateCompetencyDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public Guid CategoryId { get; set; }
}

// ── Appraisal Template ───────────────────────────────────────

public class AppraisalTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public Guid RatingScaleId { get; set; }
    public string? RatingScaleName { get; set; }
    public int SectionCount { get; set; }
    public List<AppraisalTemplateSectionDto> Sections { get; set; } = new();
}

public class AppraisalTemplateSectionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }
    public List<AppraisalTemplateSectionItemDto> Items { get; set; } = new();
}

public class AppraisalTemplateSectionItemDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }
    public Guid? CompetencyId { get; set; }
    public string? CompetencyName { get; set; }
}

public class CreateAppraisalTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid RatingScaleId { get; set; }
    public List<CreateAppraisalTemplateSectionDto> Sections { get; set; } = new();
}

public class CreateAppraisalTemplateSectionDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }
    public List<CreateAppraisalTemplateSectionItemDto> Items { get; set; } = new();
}

public class CreateAppraisalTemplateSectionItemDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int SortOrder { get; set; }
    public Guid? CompetencyId { get; set; }
}

// ── Appraisal Cycle ──────────────────────────────────────────

public class AppraisalCycleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CycleType { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Phase { get; set; } = string.Empty;

    public bool IncludeSelfAssessment { get; set; }
    public bool IncludeManagerReview { get; set; }
    public bool IncludePeerReview { get; set; }
    public bool IncludeDirectReportReview { get; set; }
    public bool IncludeExternalReview { get; set; }
    public bool IncludeGoals { get; set; }

    public int SelfWeight { get; set; }
    public int ManagerWeight { get; set; }
    public int PeerWeight { get; set; }
    public int DirectReportWeight { get; set; }
    public int ExternalWeight { get; set; }

    public DateTime? SelfDeadline { get; set; }
    public DateTime? ManagerDeadline { get; set; }
    public DateTime? PeerDeadline { get; set; }
    public DateTime? CompletionDeadline { get; set; }

    public Guid TemplateId { get; set; }
    public string? TemplateName { get; set; }

    public int TotalAppraisals { get; set; }
    public int CompletedAppraisals { get; set; }
}

public class CreateAppraisalCycleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string CycleType { get; set; } = "Annual";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

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

    public List<Guid>? EmployeeIds { get; set; }
    public List<Guid>? DepartmentIds { get; set; }
}

// ── Appraisal (per-employee) ─────────────────────────────────

public class AppraisalDto
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? FinalRating { get; set; }
    public string? FinalComments { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgementComment { get; set; }

    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public string? DepartmentName { get; set; }
    public string? PositionName { get; set; }

    public Guid CycleId { get; set; }
    public string CycleName { get; set; } = string.Empty;

    public List<AppraisalReviewerDto> Reviewers { get; set; } = new();
}

public class AppraisalReviewerDto
{
    public Guid Id { get; set; }
    public string ReviewerType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal? OverallRating { get; set; }
    public string? OverallComments { get; set; }
    public DateTime? SubmittedAt { get; set; }

    public Guid ReviewerEmployeeId { get; set; }
    public string ReviewerName { get; set; } = string.Empty;

    public List<AppraisalResponseItemDto> ResponseItems { get; set; } = new();
}

public class AppraisalResponseItemDto
{
    public Guid Id { get; set; }
    public int? RatingValue { get; set; }
    public string? Comment { get; set; }
    public Guid TemplateSectionItemId { get; set; }
    public string? ItemName { get; set; }
    public string? SectionName { get; set; }
}

// ── Appraisal Form (for submitting ratings) ──────────────────

public class AppraisalFormDto
{
    public Guid AppraisalId { get; set; }
    public Guid ReviewerId { get; set; }
    public string ReviewerType { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string CycleName { get; set; } = string.Empty;

    public RatingScaleDto RatingScale { get; set; } = null!;
    public List<AppraisalFormSectionDto> Sections { get; set; } = new();
    public List<AppraisalGoalDto>? Goals { get; set; }
}

public class AppraisalFormSectionDto
{
    public Guid SectionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public List<AppraisalFormItemDto> Items { get; set; } = new();
}

public class AppraisalFormItemDto
{
    public Guid TemplateSectionItemId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public int? CurrentRating { get; set; }
    public string? CurrentComment { get; set; }
    public int? SelfRating { get; set; }
}

public class AppraisalGoalDto
{
    public Guid GoalId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Weight { get; set; }
    public decimal Progress { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? SelfRating { get; set; }
    public int? ManagerRating { get; set; }
}

public class SubmitAppraisalDto
{
    public string? OverallComments { get; set; }
    public List<SubmitItemRatingDto> Ratings { get; set; } = new();
    public List<SubmitGoalRatingDto>? GoalRatings { get; set; }
    public bool IsFinal { get; set; }
}

public class SubmitItemRatingDto
{
    public Guid TemplateSectionItemId { get; set; }
    public int? RatingValue { get; set; }
    public string? Comment { get; set; }
}

public class SubmitGoalRatingDto
{
    public Guid GoalId { get; set; }
    public int? Rating { get; set; }
}

public class AddReviewerDto
{
    public Guid EmployeeId { get; set; }
    public string ReviewerType { get; set; } = "Peer";
}

public class CalibrateAppraisalDto
{
    public decimal FinalRating { get; set; }
    public string? Comments { get; set; }
}

public class AcknowledgeAppraisalDto
{
    public string? Comment { get; set; }
}

// ── Dashboard ────────────────────────────────────────────────

public class AppraisalCycleDashboardDto
{
    public AppraisalCycleDto Cycle { get; set; } = null!;
    public int TotalEmployees { get; set; }
    public int SelfCompleted { get; set; }
    public int ManagerCompleted { get; set; }
    public int PeerCompleted { get; set; }
    public int FullyCompleted { get; set; }
    public int Acknowledged { get; set; }
    public List<RatingDistributionDto> RatingDistribution { get; set; } = new();
    public List<DepartmentProgressDto> DepartmentProgress { get; set; } = new();
}

public class RatingDistributionDto
{
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class DepartmentProgressDto
{
    public string Department { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Completed { get; set; }
    public decimal AverageRating { get; set; }
}
