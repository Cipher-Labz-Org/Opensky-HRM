using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;

namespace OpenSkyHRM.Application.Interfaces;

public interface IRecruitmentService
{
    Task<PagedResult<RequisitionDto>> GetRequisitionsAsync(int page = 1, int pageSize = 20, string? status = null);
    Task<RequisitionDto> CreateRequisitionAsync(CreateRequisitionDto dto);
    Task<PagedResult<CandidateDto>> GetCandidatesAsync(int page = 1, int pageSize = 20, Guid? requisitionId = null);
    Task<CandidateDto> CreateCandidateAsync(CreateCandidateDto dto);
}
