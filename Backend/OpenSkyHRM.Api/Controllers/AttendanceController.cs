using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Attendance")]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendanceService;
    private readonly AppDbContext _db;

    public AttendanceController(IAttendanceService attendanceService, AppDbContext db)
    {
        _attendanceService = attendanceService;
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAttendance(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? locationId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? source = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _attendanceService.GetAttendanceAsync(
            page, pageSize, employeeId, from, to, allowedIds, departmentId, locationId, status, source, sortBy, sortDir));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _attendanceService.GetSummaryAsync(from, to, employeeId, allowedIds));
    }

    [HttpGet("summary/daily")]
    public async Task<IActionResult> GetDailySummaries(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _attendanceService.GetDailySummariesAsync(from, to, employeeId, allowedIds));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAttendanceRecordDto dto)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, dto.EmployeeId, "Update"))
            return Forbid();
        var result = await _attendanceService.CreateAsync(dto);
        return CreatedAtAction(nameof(GetAttendance), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAttendanceRecordDto dto)
    {
        var record = await _db.Set<AttendanceRecord>().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (record == null) return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, record.EmployeeId, "Update"))
            return Forbid();
        var result = await _attendanceService.UpdateAsync(id, dto);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var record = await _db.Set<AttendanceRecord>().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
        if (record == null) return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, record.EmployeeId, "Update"))
            return Forbid();
        var ok = await _attendanceService.DeleteAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("punch")]
    public async Task<IActionResult> Punch([FromBody] PunchRequestDto dto)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userId == null) return Unauthorized();
        var user = await _db.Set<User>().FirstOrDefaultAsync(u => u.Id.ToString() == userId);

        Guid? linkedEmployeeId = user?.EmployeeId;
        if (linkedEmployeeId == null && Guid.TryParse(User.FindFirst("employeeId")?.Value, out var fromClaim))
            linkedEmployeeId = fromClaim;

        Guid targetEmployeeId;
        if (dto.EmployeeId.HasValue && dto.EmployeeId.Value != Guid.Empty)
            targetEmployeeId = dto.EmployeeId.Value;
        else if (linkedEmployeeId != null)
            targetEmployeeId = linkedEmployeeId.Value;
        else
            return BadRequest("User is not linked to an employee.");

        var isSelfPunch = linkedEmployeeId == targetEmployeeId;
        if (isSelfPunch)
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, targetEmployeeId, "Read"))
                return Forbid();
        }
        else
        {
            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, targetEmployeeId, "Update"))
                return Forbid();
        }

        try
        {
            var result = await _attendanceService.PunchAsync(targetEmployeeId, dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("overtime-nopay")]
    public async Task<IActionResult> GetOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null)
    {
        if (employeeId.HasValue && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId.Value, "Read"))
            return Forbid();
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        return Ok(await _attendanceService.CalculateOvertimeNopayAsync(from, to, employeeId, allowedIds));
    }

    [HttpPost("overtime-nopay/approve")]
    public async Task<IActionResult> ApproveOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid employeeId,
        [FromBody] ApproveRejectOvertimeNopayDto? dto)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var approverId = LeaveAccessHelper.GetCurrentEmployeeId(User);
        if (!approverId.HasValue)
            return BadRequest(new { message = "Your account must be linked to an employee to approve overtime." });
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _attendanceService.SetOvertimeNopayPeriodApprovalAsync(
            from, to, employeeId, approverId.Value, true, dto?.Remarks, allowedIds);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost("overtime-nopay/reject")]
    public async Task<IActionResult> RejectOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid employeeId,
        [FromBody] ApproveRejectOvertimeNopayDto? dto)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var approverId = LeaveAccessHelper.GetCurrentEmployeeId(User);
        if (!approverId.HasValue)
            return BadRequest(new { message = "Your account must be linked to an employee to reject overtime." });
        var allowedIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var result = await _attendanceService.SetOvertimeNopayPeriodApprovalAsync(
            from, to, employeeId, approverId.Value, false, dto?.Remarks, allowedIds);
        return result == null ? NotFound() : Ok(result);
    }
}
