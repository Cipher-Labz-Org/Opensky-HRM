using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Attendance")]
[Route("api/roster")]
public class RosterController : ControllerBase
{
    private readonly IRosterService _rosterService;
    private readonly AppDbContext _db;

    public RosterController(IRosterService rosterService, AppDbContext db)
    {
        _rosterService = rosterService;
        _db = db;
    }

    private async Task<bool> CanManageRosterAsync()
    {
        if (User.IsInRole("ADMIN")) return true;
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        return allowedIds == null;
    }

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates([FromQuery] bool includeInactive = false)
    {
        return Ok(await _rosterService.GetAllTemplatesAsync(includeInactive));
    }

    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id)
    {
        var t = await _rosterService.GetTemplateByIdAsync(id);
        return t is null ? NotFound() : Ok(t);
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateRosterTemplateDto dto)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        try
        {
            var result = await _rosterService.CreateTemplateAsync(dto);
            return CreatedAtAction(nameof(GetTemplate), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] UpdateRosterTemplateDto dto)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        try
        {
            var result = await _rosterService.UpdateTemplateAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        try
        {
            var deleted = await _rosterService.DeleteTemplateAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("assignments")]
    public async Task<IActionResult> GetAssignments(
        [FromQuery] Guid? employeeId,
        [FromQuery] Guid? rosterTemplateId,
        [FromQuery] DateTime? effectiveDate)
    {
        return Ok(await _rosterService.GetAssignmentsAsync(employeeId, rosterTemplateId, effectiveDate));
    }

    [HttpGet("assignments/{id:guid}")]
    public async Task<IActionResult> GetAssignment(Guid id)
    {
        var a = await _rosterService.GetAssignmentByIdAsync(id);
        return a is null ? NotFound() : Ok(a);
    }

    [HttpPost("assignments/bulk")]
    public async Task<IActionResult> BulkCreateAssignments([FromBody] BulkCreateRosterAssignmentDto dto)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        if (dto.EmployeeIds.Count == 0) return BadRequest(new { message = "No employees selected." });
        try
        {
            var result = await _rosterService.BulkCreateAssignmentsAsync(dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("assignments")]
    public async Task<IActionResult> CreateAssignment([FromBody] CreateRosterAssignmentDto dto)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        try
        {
            var result = await _rosterService.CreateAssignmentAsync(dto);
            return CreatedAtAction(nameof(GetAssignment), new { id = result.Id }, result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("assignments/{id:guid}")]
    public async Task<IActionResult> UpdateAssignment(Guid id, [FromBody] UpdateRosterAssignmentDto dto)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        try
        {
            var result = await _rosterService.UpdateAssignmentAsync(id, dto);
            return result is null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("assignments/{id:guid}")]
    public async Task<IActionResult> DeleteAssignment(Guid id)
    {
        if (!await CanManageRosterAsync()) return Forbid();
        var deleted = await _rosterService.DeleteAssignmentAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
