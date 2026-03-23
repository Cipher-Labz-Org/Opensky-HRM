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
    private readonly IRecruitmentService _svc;
    public RecruitmentController(IRecruitmentService svc) { _svc = svc; }

    // ── Requisitions ─────────────────────────────────────────────

    [HttpGet("requisitions")]
    public async Task<IActionResult> GetRequisitions(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null, [FromQuery] Guid? departmentId = null, [FromQuery] string? priority = null)
        => Ok(await _svc.GetRequisitionsAsync(page, pageSize, status, departmentId, priority));

    [HttpGet("requisitions/{id}")]
    public async Task<IActionResult> GetRequisition(Guid id)
    {
        var r = await _svc.GetRequisitionByIdAsync(id);
        return r == null ? NotFound() : Ok(r);
    }

    [HttpPost("requisitions")]
    public async Task<IActionResult> CreateRequisition([FromBody] CreateRequisitionDto dto)
        => Ok(await _svc.CreateRequisitionAsync(dto));

    [HttpPut("requisitions/{id}")]
    public async Task<IActionResult> UpdateRequisition(Guid id, [FromBody] UpdateRequisitionDto dto)
    {
        dto.Id = id;
        return Ok(await _svc.UpdateRequisitionAsync(dto));
    }

    [HttpDelete("requisitions/{id}")]
    public async Task<IActionResult> DeleteRequisition(Guid id)
    {
        await _svc.DeleteRequisitionAsync(id);
        return NoContent();
    }

    [HttpPost("requisitions/{id}/approve")]
    public async Task<IActionResult> ApproveRequisition(Guid id)
        => Ok(await _svc.ApproveRequisitionAsync(id));

    [HttpPost("requisitions/{id}/close")]
    public async Task<IActionResult> CloseRequisition(Guid id)
        => Ok(await _svc.CloseRequisitionAsync(id));

    // ── Candidates ───────────────────────────────────────────────

    [HttpGet("candidates")]
    public async Task<IActionResult> GetCandidates(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] Guid? requisitionId = null, [FromQuery] string? stage = null, [FromQuery] string? search = null)
        => Ok(await _svc.GetCandidatesAsync(page, pageSize, requisitionId, stage, search));

    [HttpGet("candidates/{id}")]
    public async Task<IActionResult> GetCandidate(Guid id)
    {
        var c = await _svc.GetCandidateByIdAsync(id);
        return c == null ? NotFound() : Ok(c);
    }

    [HttpPost("candidates")]
    public async Task<IActionResult> CreateCandidate([FromBody] CreateCandidateDto dto)
        => Ok(await _svc.CreateCandidateAsync(dto));

    [HttpPut("candidates/{id}")]
    public async Task<IActionResult> UpdateCandidate(Guid id, [FromBody] UpdateCandidateDto dto)
    {
        dto.Id = id;
        return Ok(await _svc.UpdateCandidateAsync(dto));
    }

    [HttpDelete("candidates/{id}")]
    public async Task<IActionResult> DeleteCandidate(Guid id)
    {
        await _svc.DeleteCandidateAsync(id);
        return NoContent();
    }

    [HttpPut("candidates/{id}/stage")]
    public async Task<IActionResult> ChangeStage(Guid id, [FromBody] ChangeStagetDto dto)
        => Ok(await _svc.ChangeCandidateStageAsync(id, dto.Stage));

    [HttpPost("candidates/{id}/reject")]
    public async Task<IActionResult> RejectCandidate(Guid id, [FromBody] RejectCandidateDto dto)
        => Ok(await _svc.RejectCandidateAsync(id, dto.Reason));

    [HttpPost("candidates/{id}/hire")]
    public async Task<IActionResult> HireCandidate(Guid id, [FromBody] HireCandidateRequest? req,
        [FromServices] IEmployeeTaskService employeeTaskService)
    {
        var employeeId = await _svc.HireCandidateAsync(id);

        if (req?.OnboardingTemplateId is not null)
            await employeeTaskService.CreateTasksFromTemplateAsync(employeeId, req.OnboardingTemplateId.Value, "Onboarding");

        return Ok(new { employeeId, onboardingStarted = req?.OnboardingTemplateId is not null });
    }

    public class HireCandidateRequest
    {
        public Guid? OnboardingTemplateId { get; set; }
    }

    // ── Interviews ───────────────────────────────────────────────

    [HttpGet("candidates/{candidateId}/interviews")]
    public async Task<IActionResult> GetInterviews(Guid candidateId)
        => Ok(await _svc.GetInterviewsForCandidateAsync(candidateId));

    [HttpPost("interviews")]
    public async Task<IActionResult> CreateInterview([FromBody] CreateInterviewDto dto)
        => Ok(await _svc.CreateInterviewAsync(dto));

    [HttpPut("interviews/{id}")]
    public async Task<IActionResult> UpdateInterview(Guid id, [FromBody] UpdateInterviewDto dto)
    {
        dto.Id = id;
        return Ok(await _svc.UpdateInterviewAsync(dto));
    }

    [HttpDelete("interviews/{id}")]
    public async Task<IActionResult> DeleteInterview(Guid id)
    {
        await _svc.DeleteInterviewAsync(id);
        return NoContent();
    }

    [HttpPost("interviews/{id}/complete")]
    public async Task<IActionResult> CompleteInterview(Guid id, [FromBody] CompleteInterviewDto dto)
        => Ok(await _svc.CompleteInterviewAsync(id, dto));

    [HttpGet("interviews/upcoming")]
    public async Task<IActionResult> GetUpcomingInterviews()
        => Ok(await _svc.GetUpcomingInterviewsAsync());

    // ── Scorecards ───────────────────────────────────────────────

    [HttpGet("interviews/{id}/scorecard")]
    public async Task<IActionResult> GetScorecard(Guid id)
        => Ok(await _svc.GetScorecardAsync(id));

    [HttpPost("interviews/{id}/scorecard")]
    public async Task<IActionResult> SubmitScorecard(Guid id, [FromBody] List<ScorecardItemDto> items)
    {
        await _svc.SubmitScorecardAsync(id, items);
        return Ok();
    }

    // ── Offers ───────────────────────────────────────────────────

    [HttpPost("offers")]
    public async Task<IActionResult> CreateOffer([FromBody] CreateOfferDto dto)
        => Ok(await _svc.CreateOfferAsync(dto));

    [HttpPut("offers/{id}")]
    public async Task<IActionResult> UpdateOffer(Guid id, [FromBody] UpdateOfferDto dto)
    {
        dto.Id = id;
        return Ok(await _svc.UpdateOfferAsync(dto));
    }

    [HttpPost("offers/{id}/approve")]
    public async Task<IActionResult> ApproveOffer(Guid id)
        => Ok(await _svc.ApproveOfferAsync(id));

    [HttpPost("offers/{id}/accept")]
    public async Task<IActionResult> AcceptOffer(Guid id)
        => Ok(await _svc.AcceptOfferAsync(id));

    [HttpPost("offers/{id}/reject")]
    public async Task<IActionResult> RejectOffer(Guid id, [FromBody] RejectOfferDto dto)
        => Ok(await _svc.RejectOfferAsync(id, dto.Reason));

    [HttpPost("offers/{id}/send-email")]
    public async Task<IActionResult> SendOfferEmail(Guid id, [FromServices] IEmailService emailService)
    {
        var offer = await _svc.GetOfferWithCandidateAsync(id);
        if (offer == null) return NotFound();

        await emailService.SendOfferEmailAsync(
            offer.CandidateEmail,
            offer.CandidateName,
            offer.PositionTitle ?? offer.RequisitionTitle ?? "Open Position",
            offer.SalaryOffered,
            offer.Currency ?? "LKR",
            offer.JoiningDate,
            offer.Remarks);

        return Ok(new { message = "Offer email sent successfully.", emailConfigured = await emailService.IsConfiguredAsync() });
    }

    // ── Dashboard & Pipeline ─────────────────────────────────────

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
        => Ok(await _svc.GetDashboardAsync());

    [HttpGet("pipeline/{requisitionId}")]
    public async Task<IActionResult> GetPipeline(Guid requisitionId)
        => Ok(await _svc.GetPipelineAsync(requisitionId));
}
