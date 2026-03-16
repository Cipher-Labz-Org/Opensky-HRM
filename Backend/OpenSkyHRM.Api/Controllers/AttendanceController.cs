using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;

namespace OpenSkyHRM.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendanceService;

    public AttendanceController(IAttendanceService attendanceService)
    {
        _attendanceService = attendanceService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAttendance(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] DateTime? date = null)
    {
        return Ok(await _attendanceService.GetAttendanceAsync(page, pageSize, employeeId, date));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null)
    {
        return Ok(await _attendanceService.GetSummaryAsync(from, to, employeeId));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAttendanceRecordDto dto)
    {
        var result = await _attendanceService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetAttendance), new { id = result.Id }, result);
    }
}
