using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LeaveController : ControllerBase
{
    private readonly ILeaveService _leaveService;

    public LeaveController(ILeaveService leaveService)
    {
        _leaveService = leaveService;
    }

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] Guid? employeeId = null)
    {
        return Ok(await _leaveService.GetLeaveRequestsAsync(page, pageSize, status, employeeId));
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateLeaveRequestDto dto)
    {
        var created = await _leaveService.CreateLeaveRequestAsync(dto);
        return Ok(created);
    }

    [HttpPost("requests/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromQuery] Guid approverId, [FromBody] ApproveRejectLeaveDto dto)
    {
        var result = await _leaveService.ApproveLeaveRequestAsync(id, approverId, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("requests/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromQuery] Guid approverId, [FromBody] ApproveRejectLeaveDto dto)
    {
        var result = await _leaveService.RejectLeaveRequestAsync(id, approverId, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("types")]
    public async Task<IActionResult> GetTypes()
        => Ok(await _leaveService.GetLeaveTypesAsync());

    [HttpGet("balances/{employeeId:guid}")]
    public async Task<IActionResult> GetBalances(Guid employeeId, [FromQuery] int year)
        => Ok(await _leaveService.GetEmployeeBalancesAsync(employeeId, year));

    [HttpGet("holidays")]
    public async Task<IActionResult> GetHolidays([FromQuery] int year)
        => Ok(await _leaveService.GetHolidaysAsync(year));

    [HttpPost("holidays")]
    public async Task<IActionResult> CreateHoliday([FromBody] CreateHolidayDto dto)
        => Ok(await _leaveService.CreateHolidayAsync(dto));
}
