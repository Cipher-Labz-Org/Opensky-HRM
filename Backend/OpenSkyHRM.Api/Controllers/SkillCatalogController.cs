using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

/// <summary>
/// Skill master data under People module. Dedicated controller avoids route/method ambiguity with
/// <see cref="EmployeesController"/> (e.g. POST /api/employees vs POST /api/employees/skills-catalog).
/// </summary>
[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/skills-catalog")]
public class SkillCatalogController : ControllerBase
{
    private readonly IOrganizationService _organizationService;
    private readonly AppDbContext _db;

    public SkillCatalogController(IOrganizationService organizationService, AppDbContext db)
    {
        _organizationService = organizationService;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();

        return Ok(await _organizationService.GetSkillsCatalogAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSkillCatalogDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();
        try
        {
            return Ok(await _organizationService.CreateSkillCatalogAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateSkillCatalogDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();
        try
        {
            var updated = await _organizationService.UpdateSkillCatalogAsync(id, dto);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();
        try
        {
            var deleted = await _organizationService.DeleteSkillCatalogAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
