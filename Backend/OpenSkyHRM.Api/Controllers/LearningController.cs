using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.Learning;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Learning")]
[Route("api/learning")]
public class LearningController : ControllerBase
{
    private readonly ILearningService _learningService;
    private readonly ICertificationService _certificationService;
    private readonly AppDbContext _db;

    public LearningController(
        ILearningService learningService,
        ICertificationService certificationService,
        AppDbContext db)
    {
        _learningService = learningService;
        _certificationService = certificationService;
        _db = db;
    }

    [HttpGet("courses")]
    public async Task<IActionResult> GetCourses(CancellationToken cancellationToken)
        => Ok(await _learningService.GetCoursesAsync(cancellationToken));

    [HttpPost("courses")]
    public async Task<IActionResult> CreateCourse([FromBody] CreateCourseRequest request,
        CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        try
        {
            return Ok(await _learningService.CreateCourseAsync(request, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("courses/{id:guid}")]
    public async Task<IActionResult> UpdateCourse(Guid id, [FromBody] UpdateCourseRequest request,
        CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        try
        {
            var updated = await _learningService.UpdateCourseAsync(id, request, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("courses/{id:guid}")]
    public async Task<IActionResult> DeleteCourse(Guid id, CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        var ok = await _learningService.DeleteCourseAsync(id, cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("skills")]
    public async Task<IActionResult> GetSkills(CancellationToken cancellationToken)
        => Ok(await _learningService.GetSkillsAsync(cancellationToken));

    [HttpPost("skills")]
    public async Task<IActionResult> CreateSkill([FromBody] CreateSkillRequest request,
        CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        return Ok(await _learningService.CreateSkillAsync(request, cancellationToken));
    }

    [HttpGet("skill-matrix")]
    public async Task<IActionResult> GetSkillMatrix([FromQuery] Guid? employeeId = null,
        CancellationToken cancellationToken = default)
    {
        if (employeeId.HasValue &&
            !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _learningService.GetSkillMatrixAsync(allowedIds, employeeId, cancellationToken));
    }

    [HttpPost("skill-matrix")]
    public async Task<IActionResult> CreateSkillMatrix([FromBody] CreateSkillMatrixRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, request.EmployeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            return Ok(await _learningService.CreateSkillMatrixEntryAsync(request, allowedIds, cancellationToken));
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("skill-matrix/{id:guid}")]
    public async Task<IActionResult> UpdateSkillMatrix(Guid id, [FromBody] UpdateSkillMatrixRequest request,
        CancellationToken cancellationToken = default)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var updated = await _learningService.UpdateSkillMatrixEntryAsync(id, request, allowedIds, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpDelete("skill-matrix/{id:guid}")]
    public async Task<IActionResult> DeleteSkillMatrix(Guid id, CancellationToken cancellationToken = default)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var ok = await _learningService.DeleteSkillMatrixEntryAsync(id, allowedIds, cancellationToken);
            return ok ? NoContent() : NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpGet("certifications")]
    public async Task<IActionResult> GetCertificationCatalog(CancellationToken cancellationToken)
        => Ok(await _certificationService.GetCatalogAsync(cancellationToken));

    [HttpPost("certifications")]
    public async Task<IActionResult> CreateCertificationCatalogEntry([FromBody] CreateCertificationRequest request,
        CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        return Ok(await _certificationService.CreateCatalogEntryAsync(request, cancellationToken));
    }

    [HttpPut("certifications/{id:guid}")]
    public async Task<IActionResult> UpdateCertificationCatalogEntry(Guid id,
        [FromBody] UpdateCertificationRequest request, CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        var updated = await _certificationService.UpdateCatalogEntryAsync(id, request, cancellationToken);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("certifications/{id:guid}")]
    public async Task<IActionResult> DeleteCertificationCatalogEntry(Guid id,
        CancellationToken cancellationToken)
    {
        if (!LearningAccessHelper.CanManageLearningCatalog(User))
            return Forbid();
        var ok = await _certificationService.DeleteCatalogEntryAsync(id, cancellationToken);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("certification-summaries")]
    public async Task<IActionResult> GetCertificationSummaries(CancellationToken cancellationToken)
        => Ok(await _certificationService.GetCertificationSummariesAsync(cancellationToken));

    [HttpGet("skill-coverage")]
    public async Task<IActionResult> GetSkillCoverage(CancellationToken cancellationToken)
        => Ok(await _certificationService.GetSkillCoverageAsync(cancellationToken));
}
