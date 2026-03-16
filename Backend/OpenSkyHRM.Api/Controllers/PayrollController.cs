using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PayrollController : ControllerBase
{
    private readonly IPayrollService _payrollService;
    public PayrollController(IPayrollService payrollService) { _payrollService = payrollService; }

    [HttpGet("components")]
    public async Task<IActionResult> GetComponents()
        => Ok(await _payrollService.GetComponentsAsync());

    [HttpGet("compensation/{employeeId:guid}")]
    public async Task<IActionResult> GetCompensation(Guid employeeId)
        => Ok(await _payrollService.GetEmployeeCompensationAsync(employeeId));

    [HttpGet("revisions")]
    public async Task<IActionResult> GetRevisions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _payrollService.GetRevisionsAsync(page, pageSize));

    [HttpGet("batches")]
    public async Task<IActionResult> GetBatches([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        => Ok(await _payrollService.GetBatchesAsync(page, pageSize));

    [HttpGet("statements")]
    public async Task<IActionResult> GetStatements([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? employeeId = null)
        => Ok(await _payrollService.GetStatementsAsync(page, pageSize, employeeId));
}
