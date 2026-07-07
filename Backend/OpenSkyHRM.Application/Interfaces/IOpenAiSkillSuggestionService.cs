using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IOpenAiSkillSuggestionService
{
    Task<AiSkillSuggestionStatusDto> GetStatusAsync(CancellationToken ct = default);
    Task<AiSkillSuggestionResultDto> SuggestSkillsAsync(AiSkillSuggestionRequestDto request, CancellationToken ct = default);
}
