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
[Route("api/employees/{employeeId:guid}/certifications")]
public class EmployeeCertificationsController : ControllerBase
{
    private readonly ICertificationService _certifications;
    private readonly AppDbContext _db;

    public EmployeeCertificationsController(ICertificationService certifications, AppDbContext db)
    {
        _certifications = certifications;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> List(Guid employeeId, CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _certifications.GetEmployeeCertificationsAsync(employeeId, allowedIds, cancellationToken));
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid employeeId, [FromBody] CreateEmployeeCertificationRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            return Ok(await _certifications.CreateEmployeeCertificationAsync(
                employeeId, request, allowedIds, cancellationToken));
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
    public async Task<IActionResult> Update(Guid employeeId, Guid id,
        [FromBody] UpdateEmployeeCertificationRequest request, CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var updated = await _certifications.UpdateEmployeeCertificationAsync(
                employeeId, id, request, allowedIds, cancellationToken);
            return updated is null ? NotFound() : Ok(updated);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid employeeId, Guid id, CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");
        try
        {
            var ok = await _certifications.DeleteEmployeeCertificationAsync(employeeId, id, allowedIds, cancellationToken);
            return ok ? NoContent() : NotFound();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }
}
