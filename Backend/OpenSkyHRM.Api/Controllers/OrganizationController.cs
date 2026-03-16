using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrganizationController : ControllerBase
{
    private readonly IOrganizationService _orgService;

    public OrganizationController(IOrganizationService orgService)
    {
        _orgService = orgService;
    }

    // --- Departments ---

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
        => Ok(await _orgService.GetDepartmentsAsync());

    [HttpGet("departments/{id:guid}")]
    public async Task<IActionResult> GetDepartment(Guid id)
    {
        var dept = await _orgService.GetDepartmentByIdAsync(id);
        return dept is null ? NotFound() : Ok(dept);
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentDto dto)
    {
        var created = await _orgService.CreateDepartmentAsync(dto);
        return CreatedAtAction(nameof(GetDepartment), new { id = created.Id }, created);
    }

    [HttpPut("departments/{id:guid}")]
    public async Task<IActionResult> UpdateDepartment(Guid id, [FromBody] UpdateDepartmentDto dto)
    {
        var updated = await _orgService.UpdateDepartmentAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("departments/{id:guid}")]
    public async Task<IActionResult> DeleteDepartment(Guid id)
    {
        var deleted = await _orgService.DeleteDepartmentAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // --- Business Units ---

    [HttpGet("business-units")]
    public async Task<IActionResult> GetBusinessUnits()
        => Ok(await _orgService.GetBusinessUnitsAsync());

    [HttpPost("business-units")]
    public async Task<IActionResult> CreateBusinessUnit([FromBody] CreateLookupDto dto)
    {
        var created = await _orgService.CreateBusinessUnitAsync(dto);
        return Ok(created);
    }

    // --- Locations ---

    [HttpGet("locations")]
    public async Task<IActionResult> GetLocations()
        => Ok(await _orgService.GetLocationsAsync());

    // --- Grades ---

    [HttpGet("grades")]
    public async Task<IActionResult> GetGrades()
        => Ok(await _orgService.GetGradesAsync());

    // --- Job Titles ---

    [HttpGet("job-titles")]
    public async Task<IActionResult> GetJobTitles()
        => Ok(await _orgService.GetJobTitlesAsync());

    // --- Positions ---

    [HttpGet("positions")]
    public async Task<IActionResult> GetPositions([FromQuery] Guid? departmentId = null)
        => Ok(await _orgService.GetPositionsAsync(departmentId));
}
