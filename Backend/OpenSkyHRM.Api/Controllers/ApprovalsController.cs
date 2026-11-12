using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

/// <summary>
/// Workforce → Approvals workspace (leave / OT). Uses <b>Approvals</b> module scope only.
/// </summary>
[Authorize]
[ApiController]
[RequireLicensedModule("Approvals")]
[Route("api/approvals")]
public class ApprovalsController : ControllerBase
{
    private readonly ILeaveService _leaveService;
    private readonly AppDbContext _db;

    public ApprovalsController(ILeaveService leaveService, AppDbContext db)
    {
        _leaveService = leaveService;
        _db = db;
    }

    [HttpGet("leave-requests")]
    public async Task<IActionResult> GetLeaveRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] bool excludeSelf = false)
    {
        if (await LeaveRequestsQueryScope.CanViewEveryLeaveRequestAsync(User, _db))
        {
            return Ok(await _leaveService.GetLeaveRequestsAsync(
                page, pageSize, status, null, fromDate, toDate, null, null));
        }

        var resolved = await LeaveRequestsQueryScope.ResolveAsync(
            User, _db, forApprovalsWorkspace: true, employeeId: null, excludeSelf, page, pageSize);

        if (!resolved.Allowed)
            return Forbid();

        if (resolved.EmptyResult != null)
            return Ok(resolved.EmptyResult);

        return Ok(await _leaveService.GetLeaveRequestsAsync(
            page,
            pageSize,
            status,
            resolved.EffectiveEmployeeId,
            fromDate,
            toDate,
            resolved.AllowedEmployeeIds,
            resolved.ExcludeEmployeeId,
            resolved.IncludePendingLevel2ForDirectReports));
    }
}
