using OpenSkyHRM.Application.DTOs.Organization;

namespace OpenSkyHRM.Application.DTOs.Recruitment;

// ── Requisition ──────────────────────────────────────────────────

public class RequisitionTimelineEntryDto
{
    public string Title { get; set; } = string.Empty;
    public string Period { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
}

public class SaveRequisitionProfileDto
{
    public List<RequisitionTimelineEntryDto> Timeline { get; set; } = new();
}

public class RequisitionDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public string? EmploymentType { get; set; }
    public int? ExperienceMin { get; set; }
    public int? ExperienceMax { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? SalaryCurrency { get; set; }
    public string? Skills { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? DepartmentName { get; set; }
    public Guid DepartmentId { get; set; }
    public string? JobTitleName { get; set; }
    public Guid? JobTitleId { get; set; }
    public string? HiringManagerName { get; set; }
    public Guid? HiringManagerId { get; set; }
    public string? LocationName { get; set; }
    public Guid? LocationId { get; set; }
    public string? PositionTitle { get; set; }
    public Guid? PositionId { get; set; }
    public int CandidateCount { get; set; }

    /// <summary>False when active candidates remain (must reject or hire to employee first).</summary>
    public bool CanDelete { get; set; } = true;

    public int BlockingCandidateCount { get; set; }

    public List<RequisitionTimelineEntryDto> Timeline { get; set; } = new();
    public string? SupportingPdfOriginalFileName { get; set; }
    public bool HasSupportingPdf { get; set; }

    /// <summary>Inbox for new application emails for this requisition.</summary>
    public string? ApplicationNotificationEmail { get; set; }
}

/// <summary>Safe payload for anonymous careers pages (no notification inbox or internal-only metadata).</summary>
public class PublicRequisitionDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public string? EmploymentType { get; set; }
    public int? ExperienceMin { get; set; }
    public int? ExperienceMax { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? SalaryCurrency { get; set; }
    public string? Skills { get; set; }
    public string? DepartmentName { get; set; }
    public Guid DepartmentId { get; set; }
    public string? JobTitleName { get; set; }
    public Guid? JobTitleId { get; set; }
    public string? HiringManagerName { get; set; }
    public Guid? HiringManagerId { get; set; }
    public string? LocationName { get; set; }
    public Guid? LocationId { get; set; }
    public string? PositionTitle { get; set; }
    public Guid? PositionId { get; set; }
    public List<RequisitionTimelineEntryDto> Timeline { get; set; } = new();
}

public class CreateRequisitionDto
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; } = 1;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public string? EmploymentType { get; set; }
    public int? ExperienceMin { get; set; }
    public int? ExperienceMax { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? SalaryCurrency { get; set; }
    public string? Skills { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? HiringManagerId { get; set; }
    public Guid? LocationId { get; set; }
    /// <summary>Free-text work location. Required unless <see cref="LocationId"/> is set.</summary>
    public string? WorkLocation { get; set; }
    public Guid? PositionId { get; set; }

    /// <summary>Inbox for new candidate applications (optional; else global Recruitment:ApplicationNotificationEmail).</summary>
    public string? ApplicationNotificationEmail { get; set; }
}

public class UpdateRequisitionDto : CreateRequisitionDto
{
    public Guid Id { get; set; }
}

public class RejectRequisitionDto
{
    public string? Remarks { get; set; }
}

/// <summary>Outcome of hiring a candidate (convert to employee).</summary>
public record HireCandidateResult(Guid EmployeeId, bool CreatedNewEmployee);

/// <summary>Outcome when notifying HR about a new job application (for API diagnostics).</summary>
public sealed class JobApplicationEmailNotificationResultDto
{
    public string Status { get; set; } = "";
    public string? Message { get; set; }
}

// ── Skill suggestions & templates ────────────────────────────────

public class SkillSuggestionsDto
{
    public List<string> Suggested { get; set; } = [];
    /// <summary>Primary source: template, history, default, or mixed.</summary>
    public string Source { get; set; } = "default";
    public List<string> Catalog { get; set; } = [];
}

public class RequisitionSkillTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Keywords { get; set; } = string.Empty;
    public string Skills { get; set; } = string.Empty;
    /// <summary>Alias for master-data UIs (maps to Keywords).</summary>
    public string Code { get; set; } = string.Empty;
    /// <summary>Alias for master-data UIs (maps to Skills).</summary>
    public string? Description { get; set; }
    public Guid? JobTitleId { get; set; }
    public string? JobTitleName { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpsertRequisitionSkillTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string Keywords { get; set; } = string.Empty;
    public string Skills { get; set; } = string.Empty;
    public Guid? JobTitleId { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

// ── Candidate ────────────────────────────────────────────────────

public class CandidateDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ResumeUrl { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public DateTime AppliedAt { get; set; }
    public string? CurrentTitle { get; set; }
    public string? CurrentCompany { get; set; }
    public decimal? ExpectedSalary { get; set; }
    public string? NoticePeriod { get; set; }
    public string? Notes { get; set; }
    public int? Rating { get; set; }
    public string? RejectionReason { get; set; }
    public string? Tags { get; set; }
    public Guid RequisitionId { get; set; }
    public string? RequisitionTitle { get; set; }
    public Guid? EmployeeId { get; set; }

    /// <summary>Uploaded PDF resume available at GET /api/recruitment/candidates/{id}/resume.</summary>
    public bool HasUploadedResume { get; set; }
}

public class CandidateDetailDto : CandidateDto
{
    public Guid? RequisitionDepartmentId { get; set; }
    public Guid? RequisitionJobTitleId { get; set; }
    public Guid? RequisitionLocationId { get; set; }
    public Guid? RequisitionPositionId { get; set; }
    public List<InterviewDto> Interviews { get; set; } = new();
    public OfferDto? Offer { get; set; }
    public List<CandidateActivityDto> Activities { get; set; } = new();
}

public class HireCandidateRequestDto
{
    public CreateEmployeeDto Employee { get; set; } = null!;
}

/// <summary>Candidate self-service view of their job application (public careers).</summary>
public class PublicCandidateApplicationDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Stage { get; set; } = string.Empty;
    public DateTime AppliedAt { get; set; }
    public Guid RequisitionId { get; set; }
    public string? RequisitionTitle { get; set; }
    public bool HasUploadedResume { get; set; }
    public string? ResumeFileName { get; set; }
    public bool CanEdit { get; set; }
}

public class CreateCandidateDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ResumeUrl { get; set; }
    public string Source { get; set; } = string.Empty;
    public Guid RequisitionId { get; set; }
    public string? CurrentTitle { get; set; }
    public string? CurrentCompany { get; set; }
    public decimal? ExpectedSalary { get; set; }
    public string? NoticePeriod { get; set; }
    public string? Notes { get; set; }
    public string? Tags { get; set; }
}

public class UpdateCandidateDto : CreateCandidateDto
{
    public Guid Id { get; set; }
    public int? Rating { get; set; }
}

public class AddEvaluationNoteDto
{
    public string Note { get; set; } = string.Empty;
}

public class ChangeStagetDto
{
    public string Stage { get; set; } = string.Empty;
}

public class RejectCandidateDto
{
    public string Reason { get; set; } = string.Empty;
}

// ── Interview ────────────────────────────────────────────────────

public class InterviewDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public int Duration { get; set; }
    public string? Location { get; set; }
    public string? InterviewType { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Feedback { get; set; }
    public string? Result { get; set; }
    public int? OverallRating { get; set; }
    public string? Recommendation { get; set; }
    public string? InterviewerName { get; set; }
    public Guid? InterviewerId { get; set; }
    public Guid CandidateId { get; set; }
    public string? CandidateName { get; set; }
    public string? CandidateStage { get; set; }
    public string? RequisitionTitle { get; set; }
    public List<InterviewScorecardDto> Scorecards { get; set; } = new();
}

public class CreateInterviewDto
{
    public string Title { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public int Duration { get; set; } = 60;
    public string? Location { get; set; }
    public string? InterviewType { get; set; }
    public Guid CandidateId { get; set; }
    public Guid? InterviewerId { get; set; }
    public string? InterviewerName { get; set; }

    /// <summary>When true, sends the interview details to the candidate email (if mail is configured and the candidate has an email).</summary>
    public bool NotifyCandidateByEmail { get; set; } = true;

    /// <summary>When true, sends the interview details to the assigned interviewer work email (employee record).</summary>
    public bool NotifyInterviewerByEmail { get; set; } = true;
}

public class UpdateInterviewDto : CreateInterviewDto
{
    public Guid Id { get; set; }
}

public class CompleteInterviewDto
{
    public string? Feedback { get; set; }
    public int? OverallRating { get; set; }
    public string? Recommendation { get; set; }
    public List<ScorecardItemDto> Scorecards { get; set; } = new();
}

// ── Scorecard ────────────────────────────────────────────────────

public class InterviewScorecardDto
{
    public Guid Id { get; set; }
    public string Criteria { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

public class ScorecardItemDto
{
    public string Criteria { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

// ── Offer ────────────────────────────────────────────────────────

public class OfferDto
{
    public Guid Id { get; set; }
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; }
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string? OfferLetterUrl { get; set; }
    public string? LetterHtml { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? NegotiationRequestedAt { get; set; }
    public string? NegotiationMessage { get; set; }
    public Guid CandidateId { get; set; }
    public string? CandidateName { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? DepartmentId { get; set; }
}

public class CreateOfferDto
{
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; } = "LKR";
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? Remarks { get; set; }
    public DateTime? JoiningDate { get; set; }
    /// <summary>Overrides requisition title for {{PositionTitle}} in the letter.</summary>
    public string? PositionTitle { get; set; }
    public Guid CandidateId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? LetterHtml { get; set; }
}

public class PreviewOfferLetterDto
{
    public Guid CandidateId { get; set; }
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; } = "LKR";
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string? Remarks { get; set; }
    /// <summary>Overrides requisition title for {{PositionTitle}} in the letter.</summary>
    public string? PositionTitle { get; set; }
    /// <summary>When set, merge placeholders into this HTML instead of the system template.</summary>
    public string? TemplateHtml { get; set; }
}

public class UpdateOfferLetterDto
{
    public string? LetterHtml { get; set; }
}

public class UpdateOfferDto : CreateOfferDto
{
    public Guid Id { get; set; }
}

public class RejectOfferDto
{
    public string? Reason { get; set; }
}

/// <summary>Candidate-facing offer summary (public response link).</summary>
public class PublicOfferResponseDto
{
    public string CandidateName { get; set; } = string.Empty;
    public string PositionTitle { get; set; } = string.Empty;
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; }
    public DateTime? JoiningDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool CanRespond { get; set; }
    public bool IsAccepted { get; set; }
    public bool IsRejected { get; set; }
    public bool HasNegotiationRequest { get; set; }
    public string? NegotiationMessage { get; set; }
    public DateTime? NegotiationRequestedAt { get; set; }
    public string? LetterHtml { get; set; }
    public string? ResponseMessage { get; set; }
}

public class PublicNegotiateOfferDto
{
    public string Message { get; set; } = string.Empty;
}

public class OfferHistoryDto
{
    public Guid Id { get; set; }
    public Guid CandidateId { get; set; }
    public string? CandidateName { get; set; }
    public string? RequisitionTitle { get; set; }
    public string? PositionTitle { get; set; }
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; }
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? AcceptedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }
    public bool HasLetter { get; set; }
    public DateTime UpdatedAt { get; set; }
}

// ── Offer Email Info ─────────────────────────────────────────────

public class OfferEmailInfoDto
{
    /// <summary>Offer workflow status (e.g. Pending, Approved).</summary>
    public string Status { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string CandidateName { get; set; } = string.Empty;
    public string? PositionTitle { get; set; }
    public string? RequisitionTitle { get; set; }
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; }
    public DateTime? JoiningDate { get; set; }
    public string? Remarks { get; set; }
    public string? LetterHtml { get; set; }
}

// ── Activity ─────────────────────────────────────────────────────

public class CandidateActivityDto
{
    public Guid Id { get; set; }
    public string ActivityType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string? PerformedBy { get; set; }
    public DateTime PerformedAt { get; set; }
}

// ── Dashboard ────────────────────────────────────────────────────

public class RecruitmentDashboardDto
{
    public int OpenRequisitions { get; set; }
    public int TotalCandidates { get; set; }
    public int InterviewsThisWeek { get; set; }
    public int OffersExtended { get; set; }
    public int HiredThisMonth { get; set; }
    public double AvgTimeToHireDays { get; set; }
    public double OfferAcceptanceRate { get; set; }
    public Dictionary<string, int> PipelineByStage { get; set; } = new();
    public List<InterviewDto> UpcomingInterviews { get; set; } = new();
    public List<CandidateActivityDto> RecentActivities { get; set; } = new();
}

public class PipelineDto
{
    public Dictionary<string, int> Stages { get; set; } = new();
    public int Total { get; set; }
}

// ── Onboarding / Offboarding DTOs (kept from original) ──────────

public class OnboardingTaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public DateTime? DueDate { get; set; }
    public string? EmployeeName { get; set; }
    public Guid EmployeeId { get; set; }
}

public class OffboardingTaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? EmployeeName { get; set; }
    public Guid EmployeeId { get; set; }
    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
    public string? AssignedToUserName { get; set; }
}

public class OffboardingTaskTemplateDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
    public string? AssignedToUserName { get; set; }
}

public class CreateOffboardingTaskTemplateDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
}
