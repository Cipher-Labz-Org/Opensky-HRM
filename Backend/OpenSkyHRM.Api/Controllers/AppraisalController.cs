using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Appraisal;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/appraisal")]
public class AppraisalController : ControllerBase
{
    private readonly IAppraisalService _svc;
    private readonly AppDbContext _db;

    public AppraisalController(IAppraisalService svc, AppDbContext db)
    {
        _svc = svc;
        _db = db;
    }

    private async Task<Guid?> GetCurrentEmployeeIdAsync()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(sub, out var userId)) return null;
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
        return user?.EmployeeId;
    }

    // ── Rating Scales ─────────────────────────────────────────────

    [HttpGet("rating-scales")]
    public async Task<IActionResult> GetRatingScales() => Ok(await _svc.GetRatingScalesAsync());

    [HttpPost("rating-scales")]
    public async Task<IActionResult> CreateRatingScale([FromBody] CreateRatingScaleDto dto)
        => Ok(await _svc.CreateRatingScaleAsync(dto));

    [HttpPut("rating-scales/{id:guid}")]
    public async Task<IActionResult> UpdateRatingScale(Guid id, [FromBody] CreateRatingScaleDto dto)
    {
        var result = await _svc.UpdateRatingScaleAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("rating-scales/{id:guid}")]
    public async Task<IActionResult> DeleteRatingScale(Guid id)
    {
        try { return await _svc.DeleteRatingScaleAsync(id) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── Competencies ──────────────────────────────────────────────

    [HttpGet("competency-categories")]
    public async Task<IActionResult> GetCompetencyCategories() => Ok(await _svc.GetCompetencyCategoriesAsync());

    [HttpPost("competency-categories")]
    public async Task<IActionResult> CreateCompetencyCategory([FromBody] CreateCompetencyCategoryDto dto)
        => Ok(await _svc.CreateCompetencyCategoryAsync(dto));

    [HttpPut("competency-categories/{id:guid}")]
    public async Task<IActionResult> UpdateCompetencyCategory(Guid id, [FromBody] CreateCompetencyCategoryDto dto)
    {
        var result = await _svc.UpdateCompetencyCategoryAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("competency-categories/{id:guid}")]
    public async Task<IActionResult> DeleteCompetencyCategory(Guid id)
        => await _svc.DeleteCompetencyCategoryAsync(id) ? NoContent() : NotFound();

    [HttpPost("competencies")]
    public async Task<IActionResult> CreateCompetency([FromBody] CreateCompetencyDto dto)
        => Ok(await _svc.CreateCompetencyAsync(dto));

    [HttpPut("competencies/{id:guid}")]
    public async Task<IActionResult> UpdateCompetency(Guid id, [FromBody] CreateCompetencyDto dto)
    {
        var result = await _svc.UpdateCompetencyAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("competencies/{id:guid}")]
    public async Task<IActionResult> DeleteCompetency(Guid id)
        => await _svc.DeleteCompetencyAsync(id) ? NoContent() : NotFound();

    // ── Templates ─────────────────────────────────────────────────

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates() => Ok(await _svc.GetTemplatesAsync());

    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id)
    {
        var result = await _svc.GetTemplateByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateAppraisalTemplateDto dto)
        => Ok(await _svc.CreateTemplateAsync(dto));

    [HttpPut("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] CreateAppraisalTemplateDto dto)
    {
        var result = await _svc.UpdateTemplateAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
    {
        try { return await _svc.DeleteTemplateAsync(id) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    // ── Cycles ────────────────────────────────────────────────────

    [HttpGet("cycles")]
    public async Task<IActionResult> GetCycles() => Ok(await _svc.GetCyclesAsync());

    [HttpGet("cycles/{id:guid}")]
    public async Task<IActionResult> GetCycle(Guid id)
    {
        var result = await _svc.GetCycleByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("cycles")]
    public async Task<IActionResult> CreateCycle([FromBody] CreateAppraisalCycleDto dto)
        => Ok(await _svc.CreateCycleAsync(dto));

    [HttpPut("cycles/{id:guid}")]
    public async Task<IActionResult> UpdateCycle(Guid id, [FromBody] CreateAppraisalCycleDto dto)
    {
        try
        {
            var result = await _svc.UpdateCycleAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("cycles/{id:guid}")]
    public async Task<IActionResult> DeleteCycle(Guid id)
    {
        try { return await _svc.DeleteCycleAsync(id) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("cycles/{id:guid}/activate")]
    public async Task<IActionResult> ActivateCycle(Guid id)
    {
        try
        {
            var result = await _svc.ActivateCycleAsync(id);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPost("cycles/{id:guid}/advance")]
    public async Task<IActionResult> AdvancePhase(Guid id)
    {
        try
        {
            var result = await _svc.AdvancePhaseAsync(id);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpGet("cycles/{id:guid}/dashboard")]
    public async Task<IActionResult> GetCycleDashboard(Guid id)
    {
        var result = await _svc.GetCycleDashboardAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("cycles/{id:guid}/appraisals")]
    public async Task<IActionResult> GetAppraisalsForCycle(Guid id)
        => Ok(await _svc.GetAppraisalsForCycleAsync(id));

    // ── Appraisals ────────────────────────────────────────────────

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetAppraisal(Guid id)
    {
        var result = await _svc.GetAppraisalByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{appraisalId:guid}/form/{reviewerId:guid}")]
    public async Task<IActionResult> GetAppraisalForm(Guid appraisalId, Guid reviewerId)
    {
        var result = await _svc.GetAppraisalFormAsync(appraisalId, reviewerId);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("{appraisalId:guid}/respond/{reviewerId:guid}")]
    public async Task<IActionResult> SubmitAppraisal(Guid appraisalId, Guid reviewerId, [FromBody] SubmitAppraisalDto dto)
        => await _svc.SubmitAppraisalAsync(appraisalId, reviewerId, dto) ? Ok() : NotFound();

    [HttpPost("{appraisalId:guid}/reviewers")]
    public async Task<IActionResult> AddReviewer(Guid appraisalId, [FromBody] AddReviewerDto dto)
        => await _svc.AddReviewerAsync(appraisalId, dto) ? Ok() : NotFound();

    [HttpDelete("reviewers/{reviewerId:guid}")]
    public async Task<IActionResult> RemoveReviewer(Guid reviewerId)
    {
        try { return await _svc.RemoveReviewerAsync(reviewerId) ? NoContent() : NotFound(); }
        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{appraisalId:guid}/calibrate")]
    public async Task<IActionResult> Calibrate(Guid appraisalId, [FromBody] CalibrateAppraisalDto dto)
        => await _svc.CalibrateAsync(appraisalId, dto) ? Ok() : NotFound();

    [HttpPost("{appraisalId:guid}/acknowledge")]
    public async Task<IActionResult> Acknowledge(Guid appraisalId, [FromBody] AcknowledgeAppraisalDto dto)
        => await _svc.AcknowledgeAsync(appraisalId, dto) ? Ok() : NotFound();

    // ── My Views ──────────────────────────────────────────────────

    [HttpGet("my-appraisals")]
    public async Task<IActionResult> GetMyAppraisals()
    {
        var empId = await GetCurrentEmployeeIdAsync();
        if (empId is null) return Ok(new List<AppraisalDto>());
        return Ok(await _svc.GetMyAppraisalsAsync(empId.Value));
    }

    [HttpGet("my-reviews")]
    public async Task<IActionResult> GetMyReviewTasks()
    {
        var empId = await GetCurrentEmployeeIdAsync();
        if (empId is null) return Ok(new List<AppraisalDto>());
        return Ok(await _svc.GetMyReviewTasksAsync(empId.Value));
    }
}
