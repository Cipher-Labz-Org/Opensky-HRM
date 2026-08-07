using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("OrgStructure")]
[Route("api/[controller]")]
public class OrganizationController : ControllerBase
{
    private readonly IOrganizationService _orgService;
    private readonly AppDbContext _db;

    public OrganizationController(IOrganizationService orgService, AppDbContext db)
    {
        _orgService = orgService;
        _db = db;
    }

    private static List<T> FilterCatalogByAssignedIds<T>(List<T> items, IReadOnlyList<Guid>? assignedIds, Func<T, Guid> idSelector)
    {
        if (assignedIds == null) return items;
        var allowed = assignedIds.ToHashSet();
        return items.Where(i => allowed.Contains(idSelector(i))).ToList();
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
    {
        var items = await _orgService.GetBusinessUnitsAsync();
        var assigned = await PeopleAccessHelper.GetAssignedBusinessUnitIdsAsync(User, _db);
        return Ok(FilterCatalogByAssignedIds(items, assigned, x => x.Id));
    }

    [HttpPost("business-units")]
    public async Task<IActionResult> CreateBusinessUnit([FromBody] CreateLookupDto dto)
    {
        var created = await _orgService.CreateBusinessUnitAsync(dto);
        return Ok(created);
    }

    [HttpPut("business-units/{id:guid}")]
    public async Task<IActionResult> UpdateBusinessUnit(Guid id, [FromBody] CreateLookupDto dto)
    {
        var updated = await _orgService.UpdateBusinessUnitAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("business-units/{id:guid}")]
    public async Task<IActionResult> DeleteBusinessUnit(Guid id)
    {
        var deleted = await _orgService.DeleteBusinessUnitAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // --- Locations ---

    [HttpGet("locations")]
    public async Task<IActionResult> GetLocations()
    {
        var items = await _orgService.GetLocationsAsync();
        var assigned = await PeopleAccessHelper.GetAssignedLocationIdsAsync(User, _db);
        return Ok(FilterCatalogByAssignedIds(items, assigned, x => x.Id));
    }

    [HttpPost("locations")]
    public async Task<IActionResult> CreateLocation([FromBody] CreateLocationDto dto)
    {
        try
        {
            return Ok(await _orgService.CreateLocationAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("locations/{id:guid}")]
    public async Task<IActionResult> UpdateLocation(Guid id, [FromBody] CreateLocationDto dto)
    {
        try
        {
            var updated = await _orgService.UpdateLocationAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("locations/{id:guid}")]
    public async Task<IActionResult> DeleteLocation(Guid id)
    {
        try
        {
            var deleted = await _orgService.DeleteLocationAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // --- Grades ---

    [HttpGet("grades")]
    public async Task<IActionResult> GetGrades()
    {
        var items = await _orgService.GetGradesAsync();
        var assigned = await PeopleAccessHelper.GetAssignedGradeIdsAsync(User, _db);
        return Ok(FilterCatalogByAssignedIds(items, assigned, x => x.Id));
    }

    [HttpPost("grades")]
    public async Task<IActionResult> CreateGrade([FromBody] CreateGradeDto dto)
        => Ok(await _orgService.CreateGradeAsync(dto));

    [HttpPut("grades/{id:guid}")]
    public async Task<IActionResult> UpdateGrade(Guid id, [FromBody] CreateGradeDto dto)
    {
        var updated = await _orgService.UpdateGradeAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("grades/{id:guid}")]
    public async Task<IActionResult> DeleteGrade(Guid id)
    {
        var deleted = await _orgService.DeleteGradeAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // --- Job Titles ---

    [HttpGet("job-titles")]
    public async Task<IActionResult> GetJobTitles()
    {
        var items = await _orgService.GetJobTitlesAsync();
        var assigned = await PeopleAccessHelper.GetAssignedJobTitleIdsAsync(User, _db);
        return Ok(FilterCatalogByAssignedIds(items, assigned, x => x.Id));
    }

    [HttpPost("job-titles")]
    public async Task<IActionResult> CreateJobTitle([FromBody] CreateJobTitleDto dto)
        => Ok(await _orgService.CreateJobTitleAsync(dto));

    [HttpPut("job-titles/{id:guid}")]
    public async Task<IActionResult> UpdateJobTitle(Guid id, [FromBody] CreateJobTitleDto dto)
    {
        var updated = await _orgService.UpdateJobTitleAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("job-titles/{id:guid}")]
    public async Task<IActionResult> DeleteJobTitle(Guid id)
    {
        var deleted = await _orgService.DeleteJobTitleAsync(id);
        return deleted ? NoContent() : NotFound();
    }

    // --- Positions ---

    [HttpGet("positions")]
    public async Task<IActionResult> GetPositions([FromQuery] Guid? departmentId = null)
        => Ok(await _orgService.GetPositionsAsync(departmentId));

    [HttpGet("reporting-hierarchy")]
    public async Task<IActionResult> GetReportingHierarchy()
        => Ok(await _orgService.GetReportingHierarchyAsync());

    // --- Employment Status Types ---

    [HttpGet("employment-statuses")]
    public async Task<IActionResult> GetEmploymentStatusTypes()
        => Ok(await _orgService.GetEmploymentStatusTypesAsync());

    [HttpPost("employment-statuses")]
    public async Task<IActionResult> CreateEmploymentStatusType([FromBody] CreateEmploymentStatusTypeDto dto)
        => Ok(await _orgService.CreateEmploymentStatusTypeAsync(dto));

    [HttpPut("employment-statuses/{id:guid}")]
    public async Task<IActionResult> UpdateEmploymentStatusType(Guid id, [FromBody] CreateEmploymentStatusTypeDto dto)
    {
        var updated = await _orgService.UpdateEmploymentStatusTypeAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("employment-statuses/{id:guid}")]
    public async Task<IActionResult> DeleteEmploymentStatusType(Guid id)
    {
        try
        {
            var deleted = await _orgService.DeleteEmploymentStatusTypeAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // --- Employee Status Types ---

    [HttpGet("employee-statuses")]
    public async Task<IActionResult> GetEmployeeStatusTypes()
        => Ok(await _orgService.GetEmployeeStatusTypesAsync());

    [HttpPost("employee-statuses")]
    public async Task<IActionResult> CreateEmployeeStatusType([FromBody] CreateEmploymentStatusTypeDto dto)
        => Ok(await _orgService.CreateEmployeeStatusTypeAsync(dto));

    [HttpPut("employee-statuses/{id:guid}")]
    public async Task<IActionResult> UpdateEmployeeStatusType(Guid id, [FromBody] CreateEmploymentStatusTypeDto dto)
    {
        var updated = await _orgService.UpdateEmployeeStatusTypeAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("employee-statuses/{id:guid}")]
    public async Task<IActionResult> DeleteEmployeeStatusType(Guid id)
    {
        try
        {
            var deleted = await _orgService.DeleteEmployeeStatusTypeAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // --- Skills catalog (People qualifications, Learning matrix) ---

    [HttpGet("skills")]
    public async Task<IActionResult> GetSkillsCatalog()
        => Ok(await _orgService.GetSkillsCatalogAsync());

    [HttpPost("skills")]
    public async Task<IActionResult> CreateSkillCatalog([FromBody] CreateSkillCatalogDto dto)
    {
        try
        {
            return Ok(await _orgService.CreateSkillCatalogAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("skills/{id:guid}")]
    public async Task<IActionResult> UpdateSkillCatalog(Guid id, [FromBody] CreateSkillCatalogDto dto)
    {
        try
        {
            var updated = await _orgService.UpdateSkillCatalogAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("skills/{id:guid}")]
    public async Task<IActionResult> DeleteSkillCatalog(Guid id)
    {
        try
        {
            var deleted = await _orgService.DeleteSkillCatalogAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
