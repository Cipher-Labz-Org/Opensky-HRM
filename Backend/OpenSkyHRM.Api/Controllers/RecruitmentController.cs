using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class RecruitmentController : ControllerBase
{
    private readonly IRecruitmentService _recruitmentService;
    public RecruitmentController(IRecruitmentService recruitmentService) { _recruitmentService = recruitmentService; }

    [HttpGet("requisitions")]
    public async Task<IActionResult> GetRequisitions([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] string? status = null)
        => Ok(await _recruitmentService.GetRequisitionsAsync(page, pageSize, status));

    [HttpPost("requisitions")]
    public async Task<IActionResult> CreateRequisition([FromBody] CreateRequisitionDto dto)
        => Ok(await _recruitmentService.CreateRequisitionAsync(dto));

    [HttpGet("candidates")]
    public async Task<IActionResult> GetCandidates([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? requisitionId = null)
        => Ok(await _recruitmentService.GetCandidatesAsync(page, pageSize, requisitionId));

    [HttpPost("candidates")]
    public async Task<IActionResult> CreateCandidate([FromBody] CreateCandidateDto dto)
        => Ok(await _recruitmentService.CreateCandidateAsync(dto));
}
