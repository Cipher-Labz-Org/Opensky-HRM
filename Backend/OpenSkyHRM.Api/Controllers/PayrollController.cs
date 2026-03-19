using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PayrollController : ControllerBase
{
    private readonly IPayrollService _payrollService;
    private readonly AppDbContext _db;

    public PayrollController(IPayrollService payrollService, AppDbContext db)
    {
        _payrollService = payrollService;
        _db = db;
    }

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents()
        => Ok(await _payrollService.GetComponentsAsync());

    [HttpGet("compensation/{employeeId:guid}")]
    public async Task<IActionResult> GetCompensation(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _payrollService.GetEmployeeCompensationAsync(employeeId));
    }

    [HttpGet("revisions")]
    public async Task<IActionResult> GetRevisions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _payrollService.GetRevisionsAsync(page, pageSize));

    [HttpGet("batches")]
    public async Task<IActionResult> GetBatches([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _payrollService.GetBatchesAsync(page, pageSize));

    [HttpGet("statements")]
    public async Task<IActionResult> GetStatements([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? employeeId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _payrollService.GetStatementsAsync(page, pageSize, employeeId, allowedIds));
    }
}
