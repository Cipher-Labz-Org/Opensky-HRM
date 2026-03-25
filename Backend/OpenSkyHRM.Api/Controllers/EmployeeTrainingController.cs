using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Learning")]
[Route("api/employees/{employeeId:guid}/training-assignments")]
public class EmployeeTrainingController : ControllerBase
{
    private readonly ITrainingAssignmentService _training;
    private readonly AppDbContext _db;

    public EmployeeTrainingController(ITrainingAssignmentService training, AppDbContext db)
    {
        _training = training;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> ListForEmployee(Guid employeeId,
        [FromQuery] string? status = null,
        CancellationToken cancellationToken = default)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _training.GetAssignmentsAsync(
            allowedIds,
            employeeId,
            null,
            status,
            null,
            cancellationToken));
    }
}
