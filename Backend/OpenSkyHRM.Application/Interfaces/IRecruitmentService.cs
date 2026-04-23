using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IRecruitmentService
{
    // Requisitions
    Task<PagedResult<RequisitionDto>> GetRequisitionsAsync(int page = 1, int pageSize = 20, string? status = null, Guid? departmentId = null, string? priority = null);
    Task<RequisitionDto?> GetRequisitionByIdAsync(Guid id);
    Task<RequisitionDto> CreateRequisitionAsync(CreateRequisitionDto dto);
    Task<RequisitionDto> UpdateRequisitionAsync(UpdateRequisitionDto dto);
    Task DeleteRequisitionAsync(Guid id);
    Task<RequisitionDto> ApproveRequisitionAsync(Guid id);
    Task<RequisitionDto> RejectRequisitionAsync(Guid id, string? remarks = null);
    Task<RequisitionDto> CloseRequisitionAsync(Guid id);
    Task<RequisitionDto> SaveRequisitionProfileAsync(Guid id, SaveRequisitionProfileDto dto);
    Task<RequisitionDto> SetSupportingPdfAsync(Guid id, string storedFileName, string originalFileName);
    Task<RequisitionDto> DeleteSupportingPdfAsync(Guid id);

    // Candidates
    Task<PagedResult<CandidateDto>> GetCandidatesAsync(int page = 1, int pageSize = 50, Guid? requisitionId = null, string? stage = null, string? search = null);
    Task<CandidateDetailDto?> GetCandidateByIdAsync(Guid id);
    Task<CandidateDto> CreateCandidateAsync(CreateCandidateDto dto);

    /// <summary>After a public/job-board application, emails the configured inbox via SendGrid/SMTP. Errors are logged; does not throw.</summary>
    Task<JobApplicationEmailNotificationResultDto> NotifyJobApplicationSubmittedAsync(Guid candidateId);
    Task<CandidateDto> UpdateCandidateAsync(UpdateCandidateDto dto);
    Task DeleteCandidateAsync(Guid id);
    Task<CandidateDto> ChangeCandidateStageAsync(Guid id, string stage);
    Task<CandidateDto> RejectCandidateAsync(Guid id, string reason);
    Task<HireCandidateResult> HireCandidateAsync(Guid id);

    // Interviews
    Task<List<InterviewDto>> GetInterviewsForCandidateAsync(Guid candidateId);
    Task<InterviewDto> CreateInterviewAsync(CreateInterviewDto dto);
    Task<InterviewDto> UpdateInterviewAsync(UpdateInterviewDto dto);
    Task DeleteInterviewAsync(Guid id);
    Task<InterviewDto> CompleteInterviewAsync(Guid id, CompleteInterviewDto dto);
    Task<List<InterviewDto>> GetUpcomingInterviewsAsync();

    // Scorecards
    Task<List<InterviewScorecardDto>> GetScorecardAsync(Guid interviewId);
    Task SubmitScorecardAsync(Guid interviewId, List<ScorecardItemDto> items);

    // Offers
    Task<OfferDto> CreateOfferAsync(CreateOfferDto dto);
    Task<OfferDto> UpdateOfferAsync(UpdateOfferDto dto);
    Task<OfferDto> ApproveOfferAsync(Guid id);
    Task<OfferDto> AcceptOfferAsync(Guid id);
    Task<OfferDto> RejectOfferAsync(Guid id, string? reason);
    Task<OfferEmailInfoDto?> GetOfferWithCandidateAsync(Guid offerId);

    // Dashboard & Pipeline
    Task<RecruitmentDashboardDto> GetDashboardAsync();
    Task<PipelineDto> GetPipelineAsync(Guid requisitionId);
}
