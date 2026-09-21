using System;
using System.IO;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;
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
    private readonly IRequisitionSkillSuggestionService _skillSuggestions;
    private readonly IOpenAiSkillSuggestionService _aiSkillSuggestions;
    private readonly IEmployeeService _employeeService;
    private readonly AppDbContext _db;
    private readonly IFileStorageService _files;

    public RecruitmentController(
        IRecruitmentService svc,
        IRequisitionSkillSuggestionService skillSuggestions,
        IOpenAiSkillSuggestionService aiSkillSuggestions,
        IEmployeeService employeeService,
        AppDbContext db,
        IFileStorageService files)
    {
        _svc = svc;
        _skillSuggestions = skillSuggestions;
        _aiSkillSuggestions = aiSkillSuggestions;
        _employeeService = employeeService;
        _db = db;
        _files = files;
    }

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
    {
        try { return Ok(await _svc.CreateRequisitionAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("requisitions/{id}")]
    public async Task<IActionResult> UpdateRequisition(Guid id, [FromBody] UpdateRequisitionDto dto)
    {
        dto.Id = id;
        try { return Ok(await _svc.UpdateRequisitionAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("requisitions/{id}")]
    public async Task<IActionResult> DeleteRequisition(Guid id)
    {
        try
        {
            await _svc.DeleteRequisitionAsync(id);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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

    [HttpGet("skill-suggestions")]
    public async Task<IActionResult> GetSkillSuggestions(
        [FromQuery] string? title = null,
        [FromQuery] Guid? jobTitleId = null)
        => Ok(await _skillSuggestions.GetSuggestionsAsync(title, jobTitleId));

    [HttpGet("skill-suggestions/ai/status")]
    public async Task<IActionResult> GetAiSkillSuggestionStatus()
        => Ok(await _aiSkillSuggestions.GetStatusAsync());

    [HttpPost("skill-suggestions/ai")]
    public async Task<IActionResult> SuggestSkillsWithAi([FromBody] AiSkillSuggestionRequestDto dto)
    {
        try
        {
            return Ok(await _aiSkillSuggestions.SuggestSkillsAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("skill-templates")]
    public async Task<IActionResult> GetSkillTemplates()
        => Ok(await _skillSuggestions.GetTemplatesAsync());

    [HttpPost("skill-templates")]
    public async Task<IActionResult> CreateSkillTemplate([FromBody] UpsertRequisitionSkillTemplateDto dto)
    {
        try { return Ok(await _skillSuggestions.CreateTemplateAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("skill-templates/{id:guid}")]
    public async Task<IActionResult> UpdateSkillTemplate(Guid id, [FromBody] UpsertRequisitionSkillTemplateDto dto)
    {
        try
        {
            var updated = await _skillSuggestions.UpdateTemplateAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("skill-templates/{id:guid}")]
    public async Task<IActionResult> DeleteSkillTemplate(Guid id)
    {
        var deleted = await _skillSuggestions.DeleteTemplateAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // ── Candidates ───────────────────────────────────────────────

    [HttpGet("candidates")]
    public async Task<IActionResult> GetCandidates(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] Guid? requisitionId = null, [FromQuery] string? stage = null, [FromQuery] string? search = null,
        [FromQuery] bool? talentPool = null)
        => Ok(await _svc.GetCandidatesAsync(page, pageSize, requisitionId, stage, search, talentPool));

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

    [HttpPost("candidates/{id:guid}/assign-requisition")]
    public async Task<IActionResult> AssignCandidateRequisition(Guid id, [FromBody] AssignCandidateRequisitionDto dto)
    {
        try { return Ok(await _svc.AssignCandidateRequisitionAsync(id, dto.RequisitionId)); }
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
        IFormFile? resume)
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

        await SaveCandidateResumeAsync(created.Id, resume);

        var emailNotification = await _svc.NotifyJobApplicationSubmittedAsync(created.Id);

        var refreshed = await _svc.GetCandidateByIdAsync(created.Id);
        return Ok(new
        {
            candidate = refreshed ?? (object)created,
            emailNotification,
        });
    }

    /// <summary>Candidate self-service: find application by job + email.</summary>
    [AllowAnonymous]
    [HttpGet("public/applications/lookup")]
    public async Task<IActionResult> LookupPublicApplication(
        [FromQuery] Guid requisitionId,
        [FromQuery] string email)
    {
        var app = await _svc.LookupPublicApplicationAsync(requisitionId, email);
        return app == null
            ? NotFound(new { message = "No application found for this email on this job." })
            : Ok(app);
    }

    /// <summary>Candidate self-service: view application (email must match).</summary>
    [AllowAnonymous]
    [HttpGet("public/applications/{id:guid}")]
    public async Task<IActionResult> GetPublicApplication(Guid id, [FromQuery] string email)
    {
        var app = await _svc.GetPublicApplicationAsync(id, email);
        return app == null
            ? NotFound(new { message = "Application not found or email does not match." })
            : Ok(app);
    }

    /// <summary>Candidate self-service: update application details (optional new resume PDF).</summary>
    [AllowAnonymous]
    [HttpPut("public/applications/{id:guid}")]
    [RequestSizeLimit(15 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 15 * 1024 * 1024)]
    public async Task<IActionResult> UpdatePublicApplication(
        Guid id,
        [FromForm] string email,
        [FromForm] string firstName,
        [FromForm] string lastName,
        [FromForm] string phone,
        IFormFile? resume)
    {
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

        string? resumeFileName = null;
        if (resume != null && resume.Length > 0)
        {
            var ext = Path.GetExtension(resume.FileName).ToLowerInvariant();
            if (resume.ContentType != "application/pdf" && ext != ".pdf")
                return BadRequest(new { message = "Resume must be a PDF file." });
            resumeFileName = resume.FileName;
        }

        try
        {
            var updated = await _svc.UpdatePublicApplicationAsync(
                id,
                email,
                firstName?.Trim() ?? "",
                lastName?.Trim() ?? "",
                phone?.Trim() ?? "",
                resumeFileName);

            if (resume != null && resume.Length > 0)
                await SaveCandidateResumeAsync(id, resume);

            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpGet("public/applications/{id:guid}/resume")]
    public async Task<IActionResult> DownloadPublicApplicationResume(
        Guid id,
        [FromQuery] string email)
    {
        var app = await _svc.GetPublicApplicationAsync(id, email);
        if (app == null || !app.HasUploadedResume)
            return NotFound();

        var download = string.IsNullOrWhiteSpace(app.ResumeFileName) ? "resume.pdf" : Path.GetFileName(app.ResumeFileName);
        if (string.IsNullOrWhiteSpace(download) || download.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            download = "resume.pdf";

        return await ResumeFileResultAsync(id, download) ?? NotFound();
    }

    [HttpGet("candidates/{id:guid}/resume")]
    public async Task<IActionResult> DownloadCandidateResume(Guid id)
    {
        var detail = await _svc.GetCandidateByIdAsync(id);
        if (detail == null || !detail.HasUploadedResume)
            return NotFound();

        var download = string.IsNullOrWhiteSpace(detail.ResumeUrl) ? "resume.pdf" : Path.GetFileName(detail.ResumeUrl);
        if (string.IsNullOrWhiteSpace(download) || download.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
            download = "resume.pdf";

        return await ResumeFileResultAsync(id, download) ?? NotFound();
    }

    private string CandidateResumePath(Guid candidateId) =>
        _files.BuildLogicalPath($"candidates/{candidateId}", "resume.pdf");

    private async Task SaveCandidateResumeAsync(Guid candidateId, IFormFile resume)
    {
        await using var stream = resume.OpenReadStream();
        await _files.SaveAsync(CandidateResumePath(candidateId), stream, "application/pdf");
    }

    private async Task<IActionResult?> ResumeFileResultAsync(Guid candidateId, string downloadName)
    {
        var stored = await _files.OpenReadAsync(CandidateResumePath(candidateId));
        if (stored is null) return null;
        return File(stored.Stream, stored.ContentType ?? "application/pdf", downloadName);
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

    [HttpPost("candidates/{id}/evaluation-notes")]
    public async Task<IActionResult> AddEvaluationNote(Guid id, [FromBody] AddEvaluationNoteDto dto)
    {
        var performedBy = User.Identity?.Name;
        return Ok(await _svc.AddEvaluationNoteAsync(id, dto.Note, performedBy));
    }

    [HttpPut("candidates/{id}/stage")]
    public async Task<IActionResult> ChangeStage(Guid id, [FromBody] ChangeStagetDto dto)
        => Ok(await _svc.ChangeCandidateStageAsync(id, dto.Stage));

    [HttpPost("candidates/{id}/reject")]
    public async Task<IActionResult> RejectCandidate(Guid id, [FromBody] RejectCandidateDto dto)
        => Ok(await _svc.RejectCandidateAsync(id, dto.Reason));

    [HttpPost("candidates/{id}/reinterview")]
    public async Task<IActionResult> ReopenCandidateForInterview(Guid id)
    {
        try
        {
            return Ok(await _svc.ReopenCandidateForInterviewAsync(id));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("candidates/{id}/hire")]
    public async Task<IActionResult> HireCandidate(Guid id, [FromBody] HireCandidateRequestDto req,
        [FromServices] IEmployeeTaskService employeeTaskService)
    {
        if (req?.Employee == null)
            return BadRequest(new { message = "Employee details are required before converting a candidate." });

        var dto = req.Employee;
        var licenseErr = LicenseDateValidationProblem(dto.LicenseIssueDate, dto.LicenseExpiryDate);
        if (licenseErr != null) return licenseErr;

        EmployeeDto created;
        try
        {
            created = await _employeeService.CreateAsync(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { message = EmployeeSaveExceptionMapper.Map(ex) });
        }

        if (dto.CreateLogin != null)
        {
            var login = dto.CreateLogin;
            try
            {
                InputValidators.ValidateUsername(login.Username, "Username");
                login.Username = login.Username.Trim();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }

            if (await _db.Users.AnyAsync(u => u.Username == login.Username))
                return BadRequest(new { message = $"Username '{login.Username}' is already in use (including archived accounts). Choose a different username." });

            var user = new User
            {
                Username = login.Username,
                Email = !string.IsNullOrWhiteSpace(created.Email)
                    ? created.Email
                    : !string.IsNullOrWhiteSpace(created.OtherEmail)
                        ? created.OtherEmail
                        : $"{created.EmployeeCode.Trim().ToLowerInvariant()}@noemail.opensky.hrm",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(login.Password),
                IsActive = login.IsActive,
                EmployeeId = created.Id,
                MustChangePassword = true,
            };

            foreach (var roleId in login.RoleIds)
                user.UserRoles.Add(new UserRole { RoleId = roleId });

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        try
        {
            var hire = await _svc.LinkCandidateToEmployeeAsync(id, created.Id);
            var runOnboarding = dto.WithOnboarding && dto.OnboardingTemplateId.HasValue;
            if (runOnboarding)
                await employeeTaskService.CreateTasksFromTemplateAsync(
                    hire.EmployeeId, dto.OnboardingTemplateId!.Value, "Onboarding");

            return Ok(new { employeeId = hire.EmployeeId, onboardingStarted = runOnboarding });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private static IActionResult? LicenseDateValidationProblem(DateTime? issue, DateTime? expiry)
    {
        if (issue.HasValue && expiry.HasValue && expiry.Value < issue.Value)
            return new BadRequestObjectResult(new { message = "License expiry date cannot be before issue date." });
        return null;
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

    [HttpGet("interviews/history")]
    public async Task<IActionResult> GetInterviewHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => Ok(await _svc.GetInterviewHistoryAsync(page, pageSize));

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

    [HttpGet("offers/history")]
    public async Task<IActionResult> GetOfferHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        => Ok(await _svc.GetOfferHistoryAsync(page, pageSize));

    [HttpGet("offers/{id:guid}")]
    public async Task<IActionResult> GetOffer(Guid id)
    {
        var offer = await _svc.GetOfferByIdAsync(id);
        return offer == null ? NotFound() : Ok(offer);
    }

    [HttpGet("offers/letter-template")]
    public async Task<IActionResult> GetOfferLetterTemplate()
        => Ok(new { html = await _svc.GetOfferLetterTemplateHtmlAsync() });

    [HttpPost("offers/letter-preview")]
    public async Task<IActionResult> PreviewOfferLetter([FromBody] PreviewOfferLetterDto dto)
        => Ok(new { html = await _svc.PreviewOfferLetterAsync(dto) });

    [HttpPost("offers")]
    public async Task<IActionResult> CreateOffer([FromBody] CreateOfferDto dto)
    {
        try { return Ok(await _svc.CreateOfferAsync(dto)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        catch (DbUpdateException ex)
        {
            var inner = ex.InnerException?.Message ?? ex.Message;
            if (inner.Contains("duplicate", StringComparison.OrdinalIgnoreCase)
                || inner.Contains("unique", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new { message = "This candidate already has an offer. Edit the existing offer or withdraw it before creating a new one." });
            }
            throw;
        }
    }

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

    [HttpPut("offers/{id}/letter")]
    public async Task<IActionResult> UpdateOfferLetter(Guid id, [FromBody] UpdateOfferLetterDto dto)
    {
        try { return Ok(await _svc.UpdateOfferLetterAsync(id, dto.LetterHtml)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("offers/{id}/send-email")]
    public async Task<IActionResult> SendOfferEmail(Guid id, [FromServices] IEmailService emailService)
    {
        var offer = await _svc.GetOfferWithCandidateAsync(id);
        if (offer == null) return NotFound();
        if (!string.Equals(offer.Status, "Approved", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Offer must be approved before it can be emailed to the candidate." });

        var responseUrl = await _svc.EnsureOfferResponseUrlAsync(id);

        var pdfBytes = await emailService.SendOfferEmailAsync(
            offer.CandidateEmail,
            offer.CandidateName,
            offer.PositionTitle ?? offer.RequisitionTitle ?? "Open Position",
            offer.SalaryOffered,
            offer.Currency ?? "LKR",
            offer.JoiningDate,
            offer.Remarks,
            offer.LetterHtml,
            responseUrl);

        if (pdfBytes != null)
            await _svc.SaveOfferLetterPdfAsync(id, pdfBytes);

        return Ok(new { message = "Offer email sent successfully with PDF attachment.", emailConfigured = await emailService.IsConfiguredAsync(), responseUrl });
    }

    [AllowAnonymous]
    [HttpGet("public/offers/{token:guid}")]
    public async Task<IActionResult> GetPublicOffer(Guid token)
    {
        try
        {
            var offer = await _svc.GetPublicOfferByTokenAsync(token);
            return offer == null ? NotFound() : Ok(offer);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [AllowAnonymous]
    [HttpPost("public/offers/{token:guid}/accept")]
    public async Task<IActionResult> AcceptPublicOffer(Guid token)
    {
        try { return Ok(await _svc.AcceptOfferByTokenAsync(token)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [AllowAnonymous]
    [HttpPost("public/offers/{token:guid}/reject")]
    public async Task<IActionResult> RejectPublicOffer(Guid token, [FromBody] RejectOfferDto? dto)
    {
        try { return Ok(await _svc.RejectOfferByTokenAsync(token, dto?.Reason)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [AllowAnonymous]
    [HttpPost("public/offers/{token:guid}/negotiate")]
    public async Task<IActionResult> NegotiatePublicOffer(Guid token, [FromBody] PublicNegotiateOfferDto dto)
    {
        try { return Ok(await _svc.NegotiateOfferByTokenAsync(token, dto.Message)); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── Dashboard & Pipeline ─────────────────────────────────────

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
        => Ok(await _svc.GetDashboardAsync());

    [HttpGet("pipeline/{requisitionId}")]
    public async Task<IActionResult> GetPipeline(Guid requisitionId)
        => Ok(await _svc.GetPipelineAsync(requisitionId));
}
