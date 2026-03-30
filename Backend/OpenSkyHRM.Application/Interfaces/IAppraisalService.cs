using OpenSkyHRM.Application.DTOs.Appraisal;

namespace OpenSkyHRM.Application.Interfaces;

public interface IAppraisalService
{
    // Rating Scales
    Task<List<RatingScaleDto>> GetRatingScalesAsync();
    Task<RatingScaleDto> CreateRatingScaleAsync(CreateRatingScaleDto dto);
    Task<RatingScaleDto?> UpdateRatingScaleAsync(Guid id, CreateRatingScaleDto dto);
    Task<bool> DeleteRatingScaleAsync(Guid id);

    // Competencies
    Task<List<CompetencyCategoryDto>> GetCompetencyCategoriesAsync();
    Task<CompetencyCategoryDto> CreateCompetencyCategoryAsync(CreateCompetencyCategoryDto dto);
    Task<CompetencyCategoryDto?> UpdateCompetencyCategoryAsync(Guid id, CreateCompetencyCategoryDto dto);
    Task<bool> DeleteCompetencyCategoryAsync(Guid id);
    Task<CompetencyDto> CreateCompetencyAsync(CreateCompetencyDto dto);
    Task<CompetencyDto?> UpdateCompetencyAsync(Guid id, CreateCompetencyDto dto);
    Task<bool> DeleteCompetencyAsync(Guid id);

    // Templates
    Task<List<AppraisalTemplateDto>> GetTemplatesAsync();
    Task<AppraisalTemplateDto?> GetTemplateByIdAsync(Guid id);
    Task<AppraisalTemplateDto> CreateTemplateAsync(CreateAppraisalTemplateDto dto);
    Task<AppraisalTemplateDto?> UpdateTemplateAsync(Guid id, CreateAppraisalTemplateDto dto);
    Task<bool> DeleteTemplateAsync(Guid id);

    // Cycles
    Task<List<AppraisalCycleDto>> GetCyclesAsync();
    Task<AppraisalCycleDto?> GetCycleByIdAsync(Guid id);
    Task<AppraisalCycleDto> CreateCycleAsync(CreateAppraisalCycleDto dto);
    Task<AppraisalCycleDto?> UpdateCycleAsync(Guid id, CreateAppraisalCycleDto dto);
    Task<bool> DeleteCycleAsync(Guid id);
    Task<AppraisalCycleDto?> ActivateCycleAsync(Guid id);
    Task<AppraisalCycleDto?> AdvancePhaseAsync(Guid id);
    Task<AppraisalCycleDashboardDto?> GetCycleDashboardAsync(Guid id);

    // Appraisals
    Task<List<AppraisalDto>> GetAppraisalsForCycleAsync(Guid cycleId);
    Task<AppraisalDto?> GetAppraisalByIdAsync(Guid id);
    Task<AppraisalFormDto?> GetAppraisalFormAsync(Guid appraisalId, Guid reviewerId);
    Task<bool> SubmitAppraisalAsync(Guid appraisalId, Guid reviewerId, SubmitAppraisalDto dto);
    Task<bool> AddReviewerAsync(Guid appraisalId, AddReviewerDto dto);
    Task<bool> RemoveReviewerAsync(Guid reviewerId);
    Task<bool> CalibrateAsync(Guid appraisalId, CalibrateAppraisalDto dto);
    Task<bool> AcknowledgeAsync(Guid appraisalId, AcknowledgeAppraisalDto dto);

    // My views
    Task<List<AppraisalDto>> GetMyAppraisalsAsync(Guid employeeId);
    Task<List<AppraisalDto>> GetMyReviewTasksAsync(Guid employeeId);
}
