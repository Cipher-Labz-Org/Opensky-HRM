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
    private readonly IAttendanceQrTokenService _attendanceQrTokenService;
    private readonly AppDbContext _db;

    public AttendanceController(
        IAttendanceService attendanceService,
        IAttendanceQrTokenService attendanceQrTokenService,
        AppDbContext db)
    {
        _attendanceService = attendanceService;
        _attendanceQrTokenService = attendanceQrTokenService;
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

        var qrError = await ResolveBusinessUnitFromQrAsync(dto);
        if (qrError != null)
            return BadRequest(new { message = qrError });

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

    /// <summary>
    /// Returns a stable attendance QR payload for a business unit (printable location code).
    /// </summary>
    [HttpGet("business-unit-qr/{businessUnitId:guid}")]
    public async Task<IActionResult> GetBusinessUnitQr(Guid businessUnitId)
    {
        var bu = await _db.Set<BusinessUnit>().AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == businessUnitId && !b.IsDeleted);
        if (bu is null)
            return NotFound(new { message = "Business unit not found." });
        if (!bu.IsActive)
            return BadRequest(new { message = "Business unit is inactive." });

        var assigned = await PeopleAccessHelper.GetAssignedBusinessUnitIdsAsync(User, _db);
        if (assigned != null && !assigned.Contains(businessUnitId))
            return Forbid();

        return Ok(_attendanceQrTokenService.IssueBusinessUnitQr(bu.Id, bu.Name, bu.Code));
    }

    /// <summary>
    /// Validates a business-unit attendance QR payload without punching.
    /// </summary>
    [HttpPost("qr-validate")]
    public async Task<IActionResult> ValidateQr([FromBody] ValidateBusinessUnitAttendanceQrRequestDto dto)
    {
        var raw = dto.Token ?? dto.Payload;
        if (string.IsNullOrWhiteSpace(raw))
            return BadRequest(new { message = "Token or payload is required." });

        var result = _attendanceQrTokenService.Validate(raw);
        if (!result.Valid || !result.BusinessUnitId.HasValue)
            return BadRequest(new { message = result.Message, valid = false });

        var bu = await _db.Set<BusinessUnit>().AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == result.BusinessUnitId.Value && !b.IsDeleted);
        if (bu is null || !bu.IsActive)
            return BadRequest(new { message = "Business unit is not available.", valid = false });

        result.BusinessUnitName = bu.Name;
        result.BusinessUnitCode = bu.Code;
        return Ok(result);
    }

    /// <summary>
    /// When a QR payload is present, validate it and set BusinessUnitId. When BusinessUnitId is
    /// sent alone, ensure the unit exists.
    /// </summary>
    private async Task<string?> ResolveBusinessUnitFromQrAsync(PunchRequestDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.QrPayload))
        {
            var result = _attendanceQrTokenService.Validate(dto.QrPayload);
            if (!result.Valid || !result.BusinessUnitId.HasValue)
                return result.Message ?? "Invalid business unit QR code.";

            if (dto.BusinessUnitId.HasValue
                && dto.BusinessUnitId.Value != Guid.Empty
                && dto.BusinessUnitId.Value != result.BusinessUnitId.Value)
            {
                return "QR code does not match the selected business unit.";
            }

            dto.BusinessUnitId = result.BusinessUnitId;
        }

        if (!dto.BusinessUnitId.HasValue || dto.BusinessUnitId == Guid.Empty)
            return null;

        var bu = await _db.Set<BusinessUnit>().AsNoTracking()
            .FirstOrDefaultAsync(b => b.Id == dto.BusinessUnitId.Value && !b.IsDeleted);
        if (bu is null)
            return "Business unit not found.";
        if (!bu.IsActive)
            return "Business unit is inactive.";

        return null;
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
