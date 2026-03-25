using System.Security.Claims;
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
[Route("api/learning/training-assignments")]
public class TrainingAssignmentsController : ControllerBase
{
    private readonly ITrainingAssignmentService _training;
    private readonly AppDbContext _db;

    public TrainingAssignmentsController(ITrainingAssignmentService training, AppDbContext db)
    {
        _training = training;
        _db = db;
    }

    private static Guid? ParseEmployeeIdClaim(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue("employeeId");
        return Guid.TryParse(s, out var g) ? g : null;
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? employeeId = null,
        [FromQuery] Guid? courseId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool overdueOnly = false,
        CancellationToken cancellationToken = default)
    {
        if (employeeId.HasValue &&
            !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _training.GetAssignmentsAsync(
            allowedIds,
            employeeId,
            courseId,
            status,
            overdueOnly ? true : null,
            cancellationToken));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken = default)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var row = await _training.GetByIdAsync(id, allowedIds, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTrainingAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, request.EmployeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var created = await _training.CreateAsync(
                request,
                ParseEmployeeIdClaim(User),
                allowedIds,
                cancellationToken);
            return Ok(created);
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

    [HttpPost("bulk")]
    public async Task<IActionResult> BulkCreate([FromBody] BulkCreateTrainingAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        foreach (var eid in request.EmployeeIds)
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, eid, "Update"))
                return Forbid();
        }

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var created = await _training.BulkCreateAsync(
                request,
                ParseEmployeeIdClaim(User),
                allowedIds,
                cancellationToken);
            return Ok(created);
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

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTrainingAssignmentRequest request,
        CancellationToken cancellationToken = default)
    {
        var readAllowed = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var existing = await _training.GetByIdAsync(id, readAllowed, cancellationToken);
        if (existing is null)
            return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, existing.EmployeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var updated = await _training.UpdateAsync(id, request, allowedIds, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken = default)
    {
        var readAllowed = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var row = await _training.GetByIdAsync(id, readAllowed, cancellationToken);
        if (row is null)
            return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, row.EmployeeId, "Update"))
            return Forbid();

        var updateAllowed = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var ok = await _training.DeleteAsync(id, updateAllowed, cancellationToken);
            return ok ? NoContent() : NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
