using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IRequisitionSkillSuggestionService
{
    Task<SkillSuggestionsDto> GetSuggestionsAsync(string? title, Guid? jobTitleId, CancellationToken ct = default);
    Task<List<RequisitionSkillTemplateDto>> GetTemplatesAsync(CancellationToken ct = default);
    Task<RequisitionSkillTemplateDto> CreateTemplateAsync(UpsertRequisitionSkillTemplateDto dto, CancellationToken ct = default);
    Task<RequisitionSkillTemplateDto?> UpdateTemplateAsync(Guid id, UpsertRequisitionSkillTemplateDto dto, CancellationToken ct = default);
    Task<bool> DeleteTemplateAsync(Guid id, CancellationToken ct = default);
}
