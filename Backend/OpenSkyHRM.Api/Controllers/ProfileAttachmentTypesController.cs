using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

/// <summary>
/// Attachment-type master for People Hub (profile dropdown + Settings), under the People module
/// (same pattern as <c>/api/employees/skills-catalog</c>). Two route prefixes: canonical profile URL and
/// legacy <c>/api/organization/employee-attachment-types</c> so older frontends and caches do not 404.
/// </summary>
[Authorize]
[ApiController]
[RequireLicensedModule("People")]
[Route("api/employees/profile-attachment-types")]
[Route("api/organization/employee-attachment-types")]
public class ProfileAttachmentTypesController : ControllerBase
{
    private readonly IOrganizationService _organizationService;
    private readonly AppDbContext _db;

    public ProfileAttachmentTypesController(IOrganizationService organizationService, AppDbContext db)
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

        return Ok(await _organizationService.GetEmployeeAttachmentTypesCatalogAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeAttachmentTypeDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();
        try
        {
            return Ok(await _organizationService.CreateEmployeeAttachmentTypeAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateEmployeeAttachmentTypeDto dto)
    {
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        if (allowedIds != null && allowedIds.Count == 0)
            return Forbid();
        try
        {
            var updated = await _organizationService.UpdateEmployeeAttachmentTypeAsync(id, dto);
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
            var deleted = await _organizationService.DeleteEmployeeAttachmentTypeAsync(id);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
