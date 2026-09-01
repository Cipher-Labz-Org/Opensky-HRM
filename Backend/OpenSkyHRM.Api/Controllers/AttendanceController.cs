using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Attendance")]
[Route("api/[controller]")]
public partial class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendanceService;
    private readonly IAttendancePlaceService _attendancePlaceService;
    private readonly IAttendanceQrTokenService _attendanceQrTokenService;
    private readonly AppDbContext _db;

    public AttendanceController(
        IAttendanceService attendanceService,
        IAttendancePlaceService attendancePlaceService,
        IAttendanceQrTokenService attendanceQrTokenService,
        AppDbContext db)
    {
        _attendanceService = attendanceService;
        _attendancePlaceService = attendancePlaceService;
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

    /// <summary>Returns the company attendance check-in policy for mobile/web punch flows.</summary>
    [HttpGet("check-in-mode")]
    public async Task<IActionResult> GetCheckInMode([FromServices] ISystemSettingService settings)
    {
        var mode = AttendanceCheckInModes.Normalize(
            await settings.GetAsync(AttendanceCheckInModes.SettingKey));
        return Ok(new { mode });
    }

    [HttpPost("punch")]
    public async Task<IActionResult> Punch([FromBody] PunchRequestDto dto)
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value;
        if (userId == null || !Guid.TryParse(userId, out var accountId))
            return Unauthorized();

        var user = await _db.Set<User>().AsNoTracking().FirstOrDefaultAsync(u => u.Id == accountId);

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

        // Any authenticated user linked to an employee may punch themselves (QR / mobile ESS).
        // Punching another employee still requires People:Update on that record.
        var isSelfPunch = linkedEmployeeId == targetEmployeeId;
        if (!isSelfPunch
            && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, targetEmployeeId, "Update"))
            return Forbid();

        var qrError = await ResolveAttendanceFromQrAsync(dto);
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
    /// Returns a stable attendance QR payload for a location (printable site code).
    /// </summary>
    [HttpGet("location-qr/{locationId:guid}")]
    public async Task<IActionResult> GetLocationQr(Guid locationId)
    {
        var location = await _db.Set<Location>().AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == locationId && !l.IsDeleted);
        if (location is null)
            return NotFound(new { message = "Location not found." });
        if (!location.IsActive)
            return BadRequest(new { message = "Location is inactive." });

        var assigned = await PeopleAccessHelper.GetAssignedLocationIdsAsync(User, _db);
        if (assigned != null && !assigned.Contains(locationId))
            return Forbid();

        return Ok(_attendanceQrTokenService.IssueLocationQr(location.Id, location.Name, location.Code));
    }

    /// <summary>
    /// Validates a business-unit or location attendance QR payload without punching.
    /// </summary>
    [HttpPost("qr-validate")]
    public async Task<IActionResult> ValidateQr([FromBody] ValidateBusinessUnitAttendanceQrRequestDto dto)
    {
        var raw = dto.Token ?? dto.Payload;
        if (string.IsNullOrWhiteSpace(raw))
            return BadRequest(new { message = "Token or payload is required." });

        var result = _attendanceQrTokenService.Validate(raw);
        if (!result.Valid)
            return BadRequest(new { message = result.Message, valid = false });

        if (result.BusinessUnitId.HasValue)
        {
            var bu = await _db.Set<BusinessUnit>().AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == result.BusinessUnitId.Value && !b.IsDeleted);
            if (bu is null || !bu.IsActive)
                return BadRequest(new { message = "Business unit is not available.", valid = false });

            result.BusinessUnitName = bu.Name;
            result.BusinessUnitCode = bu.Code;
        }
        else if (result.LocationId.HasValue)
        {
            var location = await _db.Set<Location>().AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == result.LocationId.Value && !l.IsDeleted);
            if (location is null || !location.IsActive)
                return BadRequest(new { message = "Location is not available.", valid = false });

            result.LocationName = location.Name;
            result.LocationCode = location.Code;
        }

        return Ok(result);
    }

    /// <summary>
    /// When a QR payload is present, validate it and set BusinessUnitId or LocationId.
    /// </summary>
    private async Task<string?> ResolveAttendanceFromQrAsync(PunchRequestDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.QrPayload))
        {
            var result = _attendanceQrTokenService.Validate(dto.QrPayload);
            if (!result.Valid)
                return result.Message ?? "Invalid attendance QR code.";

            if (result.BusinessUnitId.HasValue)
            {
                if (dto.BusinessUnitId.HasValue
                    && dto.BusinessUnitId.Value != Guid.Empty
                    && dto.BusinessUnitId.Value != result.BusinessUnitId.Value)
                {
                    return "QR code does not match the selected business unit.";
                }

                dto.BusinessUnitId = result.BusinessUnitId;
            }
            else if (result.LocationId.HasValue)
            {
                if (dto.LocationId.HasValue
                    && dto.LocationId.Value != Guid.Empty
                    && dto.LocationId.Value != result.LocationId.Value)
                {
                    return "QR code does not match the selected location.";
                }

                dto.LocationId = result.LocationId;
            }
            else
            {
                return "Invalid attendance QR code.";
            }
        }

        if (dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty)
        {
            var bu = await _db.Set<BusinessUnit>().AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == dto.BusinessUnitId.Value && !b.IsDeleted);
            if (bu is null)
                return "Business unit not found.";
            if (!bu.IsActive)
                return "Business unit is inactive.";
        }

        if (dto.LocationId.HasValue && dto.LocationId != Guid.Empty)
        {
            var location = await _db.Set<Location>().AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == dto.LocationId.Value && !l.IsDeleted);
            if (location is null)
                return "Location not found.";
            if (!location.IsActive)
                return "Location is inactive.";
        }

        return null;
    }

    [HttpGet("places")]
    public async Task<IActionResult> GetPlaces()
    {
        return Ok(await _attendancePlaceService.GetAllAsync());
    }

    [HttpGet("places/{id:guid}")]
    public async Task<IActionResult> GetPlace(Guid id)
    {
        var place = await _attendancePlaceService.GetByIdAsync(id);
        return place is null ? NotFound() : Ok(place);
    }

    [HttpPost("places")]
    public async Task<IActionResult> CreatePlace([FromBody] CreateAttendancePlaceDto dto)
    {
        try
        {
            return Ok(await _attendancePlaceService.CreateAsync(dto));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { message = MapPlaceSaveError(ex) });
        }
    }

    [HttpPut("places/{id:guid}")]
    public async Task<IActionResult> UpdatePlace(Guid id, [FromBody] UpdateAttendancePlaceDto dto)
    {
        try
        {
            var place = await _attendancePlaceService.UpdateAsync(id, dto);
            return place is null ? NotFound() : Ok(place);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { message = MapPlaceSaveError(ex) });
        }
    }

    [HttpDelete("places/{id:guid}")]
    public async Task<IActionResult> DeletePlace(Guid id)
    {
        var ok = await _attendancePlaceService.DeleteAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("overtime-nopay")]
    public async Task<IActionResult> GetOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] bool teamOnly = false)
    {
        var actingId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(User, _db);
        var allowedIds = await GetOvertimeVisibleEmployeeIdsAsync(actingId, teamOnly);
        if (employeeId.HasValue && allowedIds != null && !allowedIds.Contains(employeeId.Value))
            return Forbid();
        var hrCanOverride = PeopleAccessHelper.CanOverrideOvertimeApproval(User);
        var rows = await _attendanceService.CalculateOvertimeNopayAsync(
            from, to, employeeId, allowedIds, actingEmployeeId: actingId, hrCanOverride: hrCanOverride);
        return Ok(rows);
    }

    [HttpGet("overtime-nopay/days")]
    public async Task<IActionResult> GetOvertimeNopayDays(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] bool teamOnly = false)
    {
        var actingId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(User, _db);
        var allowedIds = await GetOvertimeVisibleEmployeeIdsAsync(actingId, teamOnly);
        if (employeeId.HasValue && allowedIds != null && !allowedIds.Contains(employeeId.Value))
            return Forbid();
        var rows = await _attendanceService.GetOvertimeNopayDaysAsync(from, to, employeeId, allowedIds);
        return Ok(rows);
    }

    [HttpPost("overtime-nopay/approve")]
    public async Task<IActionResult> ApproveOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid employeeId,
        [FromQuery] bool teamOnly = false,
        [FromBody] ApproveRejectOvertimeNopayDto? dto = null)
    {
        var hrCanOverride = PeopleAccessHelper.CanOverrideOvertimeApproval(User);
        var approverId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(User, _db);
        if (!approverId.HasValue && !hrCanOverride)
            return BadRequest(new { message = "Your account must be linked to an employee to approve overtime." });
        var allowedIds = await GetOvertimeVisibleEmployeeIdsAsync(approverId, teamOnly);
        if (allowedIds != null && !allowedIds.Contains(employeeId))
            return Forbid();
        try
        {
            var result = await _attendanceService.SetOvertimeNopayPeriodApprovalAsync(
                from, to, employeeId, approverId, true, dto?.Remarks, allowedIds, hrCanOverride);
            return result == null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("overtime-nopay/reject")]
    public async Task<IActionResult> RejectOvertimeNopay(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] Guid employeeId,
        [FromQuery] bool teamOnly = false,
        [FromBody] ApproveRejectOvertimeNopayDto? dto = null)
    {
        var hrCanOverride = PeopleAccessHelper.CanOverrideOvertimeApproval(User);
        var approverId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(User, _db);
        if (!approverId.HasValue && !hrCanOverride)
            return BadRequest(new { message = "Your account must be linked to an employee to reject overtime." });
        var allowedIds = await GetOvertimeVisibleEmployeeIdsAsync(approverId, teamOnly);
        if (allowedIds != null && !allowedIds.Contains(employeeId))
            return Forbid();
        try
        {
            var result = await _attendanceService.SetOvertimeNopayPeriodApprovalAsync(
                from, to, employeeId, approverId, false, dto?.Remarks, allowedIds, hrCanOverride);
            return result == null ? NotFound() : Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private async Task<HashSet<Guid>> GetReportingDescendantIdsAsync(Guid? actingEmployeeId)
    {
        if (!actingEmployeeId.HasValue)
            return [];
        var graph = await ReportingChain.LoadAsync(_db);
        return ReportingChain.GetDescendantIds(graph, actingEmployeeId.Value);
    }

    /// <summary>
    /// Approvals (teamOnly) limits supervisors to their reporting tree.
    /// HR / ADMIN keep company-wide People access so they can approve OT the supervisor has not.
    /// </summary>
    private async Task<IReadOnlyList<Guid>?> GetOvertimeVisibleEmployeeIdsAsync(Guid? actingEmployeeId, bool teamOnly)
    {
        var descendants = await GetReportingDescendantIdsAsync(actingEmployeeId);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(User, _db);
        var hrCanOverride = PeopleAccessHelper.CanOverrideOvertimeApproval(User);

        if (teamOnly && !hrCanOverride)
        {
            if (!actingEmployeeId.HasValue)
                return Array.Empty<Guid>();
            return PeopleAccessHelper.IntersectEmployeeScopes(descendants.ToList(), dimensionIds)
                ?? descendants.ToList();
        }

        var peopleRead = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read");
        var peopleScope = PeopleAccessHelper.ResolvePeopleScope(
            User.FindAll("permission").Select(c => c.Value), "Read");

        if (!hrCanOverride && (UserHasRole("SUPERVISOR") || peopleScope == "Team"))
        {
            return PeopleAccessHelper.IntersectEmployeeScopes(descendants.ToList(), dimensionIds)
                ?? descendants.ToList();
        }

        if (descendants.Count == 0)
            return peopleRead;
        if (peopleRead == null)
            return null;

        var merged = peopleRead.Union(descendants).ToList();
        return PeopleAccessHelper.IntersectEmployeeScopes(merged, dimensionIds);
    }

    private bool UserHasRole(string roleCode)
    {
        if (User.IsInRole(roleCode)) return true;
        foreach (var c in User.FindAll(System.Security.Claims.ClaimTypes.Role).Concat(User.FindAll("role")))
        {
            if (string.Equals(c.Value, roleCode, StringComparison.OrdinalIgnoreCase))
                return true;
            if (roleCode == "ADMIN" && string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase))
                return true;
            if (roleCode == "SUPERVISOR" && string.Equals(c.Value, "Supervisor", StringComparison.OrdinalIgnoreCase))
                return true;
            if (roleCode == "HR_MANAGER" && (
                string.Equals(c.Value, "HR Manager", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Value, "HR_MANAGER", StringComparison.OrdinalIgnoreCase)))
                return true;
        }
        return false;
    }

    private static string MapPlaceSaveError(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        if (message.Contains("IX_AttendancePlaces_Code", StringComparison.OrdinalIgnoreCase)
            || message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
        {
            return "An attendance place with this code already exists. Delete the old attendance place first, or use a unique code.";
        }

        if (message.Contains("IX_AttendancePlaces_LocationId", StringComparison.OrdinalIgnoreCase))
        {
            return "An attendance place already exists for this location.";
        }

        if (message.Contains("IX_AttendancePlaces_BusinessUnitId", StringComparison.OrdinalIgnoreCase))
        {
            return "An attendance place already exists for this business unit.";
        }

        return "Could not save the attendance place. Please check the values and try again.";
    }
}
