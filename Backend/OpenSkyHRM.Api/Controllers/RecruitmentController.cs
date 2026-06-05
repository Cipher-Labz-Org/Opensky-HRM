using System;
using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

using OpenSkyHRM.Api.Filters;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Recruitment")]
[Route("api/[controller]")]
public class RecruitmentController : ControllerBase
{
    private readonly IRecruitmentService _svc;
    public RecruitmentController(IRecruitmentService svc) => _svc = svc;

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

    /// <summary>Public careers page: approved, open requisitions only (no auth).</summary>
    [AllowAnonymous]
    [HttpGet("public/requisitions/{id}")]
    public async Task<IActionResult> GetPublicRequisition(Guid id)
    {
        var (dto, deny) = await _svc.TryGetPublicJobPostingAsync(id);
        if (deny == "not_found")
            return NotFound(new { code = deny, message = "No job was found for this link. Check the URL or ask HR for an updated link." });
        if (deny == "closed")
            return NotFound(new
            {
                code = deny,
                message = "This requisition is closed and is no longer accepting applications.",
            });
        if (deny == "not_published")
            return NotFound(new
            {
                code = deny,
                message =
                    "This job is not available on the public careers page yet. In Recruitment, the requisition must be approved (or pending final approval) and not closed.",
            });
        return Ok(dto);
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
    {
        try { return Ok(await _svc.ApproveRequisitionAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("requisitions/{id}/reject")]
    public async Task<IActionResult> RejectRequisition(Guid id, [FromBody] RejectRequisitionDto? dto)
    {
        try { return Ok(await _svc.RejectRequisitionAsync(id, dto?.Remarks)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("requisitions/{id}/close")]
    public async Task<IActionResult> CloseRequisition(Guid id)
    {
        try { return Ok(await _svc.CloseRequisitionAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

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
    {
        try { return Ok(await _svc.CreateCandidateAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    /// <summary>Public-style apply with PDF resume: saves candidate then stores file at wwwroot/uploads/candidates/{id}/resume.pdf.</summary>
    [AllowAnonymous]
    [HttpPost("candidates/apply")]
    [RequestSizeLimit(15 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 15 * 1024 * 1024)]
    public async Task<IActionResult> ApplyWithResume(
        [FromForm] string firstName,
        [FromForm] string lastName,
        [FromForm] string email,
        [FromForm] string phone,
        [FromForm] Guid requisitionId,
        [FromForm] string? source,
        IFormFile? resume,
        [FromServices] IWebHostEnvironment env)
    {
        if (resume == null || resume.Length == 0)
            return BadRequest(new { message = "Resume PDF is required." });
        var ext = Path.GetExtension(resume.FileName).ToLowerInvariant();
        if (resume.ContentType != "application/pdf" && ext != ".pdf")
            return BadRequest(new { message = "Resume must be a PDF file." });

        var isAnon = !(User.Identity?.IsAuthenticated ?? false);
        if (isAnon && !await _svc.RequisitionAcceptsPublicApplicationsAsync(requisitionId))
            return NotFound(new
            {
                message =
                    "This position is not open for applications. The requisition must be Approved (or pending final approval) and not closed.",
            });

        var notes =
            $"Applied via job application form. Resume (PDF): {resume.FileName}";

        var resolvedSource = isAnon
            ? "Public careers link"
            : (string.IsNullOrWhiteSpace(source) ? "Direct" : source.Trim());

        try
        {
            InputValidators.ValidatePersonName(firstName, "First name");
            InputValidators.ValidatePersonName(lastName, "Last name");
            InputValidators.ValidatePhone(phone, "Phone", required: true);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var dto = new CreateCandidateDto
        {
            FirstName = firstName?.Trim() ?? "",
            LastName = lastName?.Trim() ?? "",
            Email = email?.Trim() ?? "",
            Phone = phone?.Trim(),
            ResumeUrl = resume.FileName,
            Source = resolvedSource,
            RequisitionId = requisitionId,
            Notes = notes,
        };

        CandidateDto created;
        try
        {
            created = await _svc.CreateCandidateAsync(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var dir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "candidates", created.Id.ToString());
        Directory.CreateDirectory(dir);
        var path = Path.Combine(dir, "resume.pdf");
        await using (var fs = System.IO.File.Create(path))
            await resume.CopyToAsync(fs);

        var emailNotification = await _svc.NotifyJobApplicationSubmittedAsync(created.Id);

        var refreshed = await _svc.GetCandidateByIdAsync(created.Id);
        return Ok(new
        {
            candidate = refreshed ?? (object)created,
            emailNotification,
        });
    }

    [HttpGet("candidates/{id:guid}/resume")]
    public async Task<IActionResult> DownloadCandidateResume(Guid id, [FromServices] IWebHostEnvironment env)
    {
        var detail = await _svc.GetCandidateByIdAsync(id);
        if (detail == null || !detail.HasUploadedResume)
            return NotFound();

        var path = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "candidates", id.ToString(), "resume.pdf");
        if (!System.IO.File.Exists(path))
            return NotFound();

        var download = string.IsNullOrWhiteSpace(detail.ResumeUrl) ? "resume.pdf" : Path.GetFileName(detail.ResumeUrl);
        if (string.IsNullOrWhiteSpace(download) || download.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            download = "resume.pdf";

        var bytes = await System.IO.File.ReadAllBytesAsync(path);
        return File(bytes, "application/pdf", download);
    }

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
        try
        {
            var hire = await _svc.HireCandidateAsync(id);
            var runOnboarding = req?.OnboardingTemplateId is not null && hire.CreatedNewEmployee;
            if (runOnboarding)
                await employeeTaskService.CreateTasksFromTemplateAsync(
                    hire.EmployeeId, req!.OnboardingTemplateId!.Value, "Onboarding");

            return Ok(new { employeeId = hire.EmployeeId, onboardingStarted = runOnboarding });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
        try { return Ok(await _svc.UpdateOfferAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("offers/{id}/approve")]
    public async Task<IActionResult> ApproveOffer(Guid id)
    {
        try { return Ok(await _svc.ApproveOfferAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("offers/{id}/accept")]
    public async Task<IActionResult> AcceptOffer(Guid id)
    {
        try { return Ok(await _svc.AcceptOfferAsync(id)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("offers/{id}/reject")]
    public async Task<IActionResult> RejectOffer(Guid id, [FromBody] RejectOfferDto? dto)
    {
        try { return Ok(await _svc.RejectOfferAsync(id, dto?.Reason)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("offers/{id}/send-email")]
    public async Task<IActionResult> SendOfferEmail(Guid id, [FromServices] IEmailService emailService)
    {
        var offer = await _svc.GetOfferWithCandidateAsync(id);
        if (offer == null) return NotFound();
        if (!string.Equals(offer.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Offer must be approved before it can be emailed to the candidate." });

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
