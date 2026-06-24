using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Leave")]
[Route("api/leave")]
public class LeaveController : ControllerBase
{
    private readonly ILeaveService _leaveService;
    private readonly ILeaveEntitlementService _entitlementService;
    private readonly AppDbContext _db;

    public LeaveController(ILeaveService leaveService, ILeaveEntitlementService entitlementService, AppDbContext db)
    {
        _leaveService = leaveService;
        _entitlementService = entitlementService;
        _db = db;
    }

    // ───── Dashboard ─────

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard()
    {
        if (LeaveAccessHelper.ResolveScope(User, "Read") != "All")
            return Forbid();
        return Ok(await _leaveService.GetDashboardAsync());
    }

    // ───── Leave Requests ─────

    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] Guid? employeeId = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] bool excludeSelf = false)
    {
        var scope = LeaveAccessHelper.ResolveScope(User, "Read");
        Guid? effectiveEmployeeId = employeeId;
        IReadOnlyList<Guid>? allowedIds = null;
        Guid? excludeEmployeeId = null;

        if (scope == "Own")
        {
            var currentId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!currentId.HasValue) return Forbid();
            effectiveEmployeeId = currentId;
        }
        else if (scope == "Team")
        {
            allowedIds = await LeaveAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Read", excludeSelfForApprovalList: excludeSelf);
            if (excludeSelf)
                excludeEmployeeId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (allowedIds is { Count: 0 }) return Ok(new PagedResult<LeaveRequestDto> { Items = new List<LeaveRequestDto>(), TotalCount = 0, Page = page, PageSize = pageSize });
        }

        return Ok(await _leaveService.GetLeaveRequestsAsync(page, pageSize, status, effectiveEmployeeId, fromDate, toDate, allowedIds, excludeEmployeeId));
    }

    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest([FromBody] CreateLeaveRequestDto dto)
    {
        var scope = LeaveAccessHelper.ResolveScope(User, "Create");
        if (scope == "Own")
        {
            var currentId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!currentId.HasValue || dto.EmployeeId != currentId.Value)
                return Forbid();
        }
        try
        {
            var created = await _leaveService.CreateLeaveRequestAsync(dto);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>Creates a leave request with an optional medical certificate PDF (required for sick leave longer than 2 days).</summary>
    [HttpPost("requests/with-document")]
    [RequestFormLimits(MultipartBodyLengthLimit = 15_000_000)]
    public async Task<IActionResult> CreateRequestWithDocument(
        [FromForm] Guid employeeId,
        [FromForm] Guid leaveTypeId,
        [FromForm] DateTime startDate,
        [FromForm] DateTime endDate,
        [FromForm] decimal totalDays,
        [FromForm] string? reason,
        [FromForm] string? coveragePerson,
        IFormFile? medicalCertificate,
        [FromServices] IWebHostEnvironment env)
    {
        var scope = LeaveAccessHelper.ResolveScope(User, "Create");
        if (scope == "Own")
        {
            var currentId = LeaveAccessHelper.GetCurrentEmployeeId(User);
            if (!currentId.HasValue || employeeId != currentId.Value)
                return Forbid();
        }

        string? medicalUrl = null;
        if (medicalCertificate is { Length: > 0 })
        {
            var ext = Path.GetExtension(medicalCertificate.FileName).ToLowerInvariant();
            var isPdf = string.Equals(ext, ".pdf", StringComparison.Ordinal)
                || string.Equals(medicalCertificate.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase);
            if (!isPdf)
                return BadRequest(new { message = "Medical certificate must be a PDF file." });

            var token = Guid.NewGuid();
            var dir = Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "leave-certificates", token.ToString());
            Directory.CreateDirectory(dir);
            var physicalPath = Path.Combine(dir, "medical-certificate.pdf");
            await using (var stream = System.IO.File.Create(physicalPath))
                await medicalCertificate.CopyToAsync(stream);
            medicalUrl = $"/uploads/leave-certificates/{token}/medical-certificate.pdf";
        }

        var dto = new CreateLeaveRequestDto
        {
            EmployeeId = employeeId,
            LeaveTypeId = leaveTypeId,
            StartDate = startDate,
            EndDate = endDate,
            TotalDays = totalDays,
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            CoveragePerson = string.IsNullOrWhiteSpace(coveragePerson) ? null : coveragePerson.Trim(),
        };

        try
        {
            var created = await _leaveService.CreateLeaveRequestAsync(dto, medicalUrl);
            return Ok(created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("requests/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRejectLeaveDto dto)
    {
        var approverId = LeaveAccessHelper.GetCurrentEmployeeId(User);
        if (!approverId.HasValue)
            return BadRequest(new { message = "Your account must be linked to an employee to approve leave. Link your user to an employee in People." });
        var request = await _db.Set<Domain.Entities.LeaveRequest>().FindAsync(id);
        if (request is null) return NotFound();

        if (request.Status is ApprovalStatus.Pending or ApprovalStatus.PendingLevel2)
        {
            var responsibleId = await _leaveService.GetResponsibleApproverEmployeeIdAsync(id);
            if (!responsibleId.HasValue || responsibleId.Value != approverId.Value)
                return Forbid();
        }

        var result = await _leaveService.ApproveLeaveRequestAsync(id, approverId.Value, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("requests/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRejectLeaveDto dto)
    {
        var approverId = LeaveAccessHelper.GetCurrentEmployeeId(User);
        if (!approverId.HasValue)
            return BadRequest(new { message = "Your account must be linked to an employee to reject leave. Link your user to an employee in People." });
        var request = await _db.Set<Domain.Entities.LeaveRequest>().FindAsync(id);
        if (request is null) return NotFound();

        if (request.Status is ApprovalStatus.Pending or ApprovalStatus.PendingLevel2)
        {
            var responsibleId = await _leaveService.GetResponsibleApproverEmployeeIdAsync(id);
            if (!responsibleId.HasValue || responsibleId.Value != approverId.Value)
                return Forbid();
        }

        var result = await _leaveService.RejectLeaveRequestAsync(id, approverId.Value, dto);
        return result is null ? NotFound() : Ok(result);
    }

    // ───── Approval Workflow Config ─────

    [HttpGet("approval-config")]
    public async Task<IActionResult> GetApprovalConfig()
    {
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LeaveApprovalLevels");
        var levels = int.TryParse(setting?.Value, out var v) ? v : 1;
        return Ok(new { levels });
    }

    [HttpPut("approval-config")]
    public async Task<IActionResult> SetApprovalConfig([FromBody] ApprovalConfigRequest request)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var levels = Math.Clamp(request.Levels, 1, 2);
        var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "LeaveApprovalLevels");
        if (setting != null)
        {
            setting.Value = levels.ToString();
        }
        else
        {
            _db.SystemSettings.Add(new Domain.Entities.SystemSetting
            {
                Key = "LeaveApprovalLevels",
                Value = levels.ToString(),
                Description = "Number of leave approval levels (1 or 2)"
            });
        }
        await _db.SaveChangesAsync();
        return Ok(new { levels });
    }

    public record ApprovalConfigRequest(int Levels);

    [HttpGet("supervisors/{employeeId:guid}")]
    public async Task<IActionResult> GetSupervisors(Guid employeeId)
    {
        var supervisors = await _db.EmployeeSupervisors
            .Include(es => es.Supervisor)
            .Where(es => es.EmployeeId == employeeId)
            .Select(es => new
            {
                es.SupervisorId,
                Name = es.Supervisor.FirstName + " " + es.Supervisor.LastName,
                es.ReportingMethod,
            })
            .ToListAsync();
        return Ok(supervisors);
    }

    // ───── Leave Types ─────

    [HttpGet("types")]
    public async Task<IActionResult> GetTypes()
        => Ok(await _leaveService.GetLeaveTypesAsync());

    [HttpPost("types")]
    public async Task<IActionResult> CreateType([FromBody] CreateLeaveTypeDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Create") != "All")
            return Forbid();
        return Ok(await _leaveService.CreateLeaveTypeAsync(dto));
    }

    [HttpPut("types/{id:guid}")]
    public async Task<IActionResult> UpdateType(Guid id, [FromBody] UpdateLeaveTypeDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var result = await _leaveService.UpdateLeaveTypeAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("types/{id:guid}")]
    public async Task<IActionResult> DeleteType(Guid id)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Delete") != "All")
            return Forbid();
        return await _leaveService.DeleteLeaveTypeAsync(id) ? NoContent() : NotFound();
    }

    // ───── Leave Policies ─────

    [HttpGet("policies")]
    public async Task<IActionResult> GetPolicies()
        => Ok(await _leaveService.GetLeavePoliciesAsync());

    [HttpPost("policies")]
    public async Task<IActionResult> CreatePolicy([FromBody] CreateLeavePolicyDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Create") != "All")
            return Forbid();
        return Ok(await _leaveService.CreateLeavePolicyAsync(dto));
    }

    [HttpPut("policies/{id:guid}")]
    public async Task<IActionResult> UpdatePolicy(Guid id, [FromBody] UpdateLeavePolicyDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var result = await _leaveService.UpdateLeavePolicyAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("policies/{id:guid}")]
    public async Task<IActionResult> DeletePolicy(Guid id)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Delete") != "All")
            return Forbid();
        return await _leaveService.DeleteLeavePolicyAsync(id) ? NoContent() : NotFound();
    }

    // ───── Leave Balances ─────

    [HttpGet("balances/{employeeId:guid}")]
    public async Task<IActionResult> GetBalances(Guid employeeId, [FromQuery] int year, [FromQuery] int? asOfMonth = null)
    {
        if (!await LeaveAccessHelper.CanAccessEmployeeLeaveAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var asOfDate = ResolveAsOfDate(year, asOfMonth);
        if (asOfMonth.HasValue && asOfDate is null)
            return BadRequest(new { message = "asOfMonth must be between 1 and 12." });
        return Ok(await _leaveService.GetEmployeeBalancesAsync(employeeId, year, asOfDate));
    }

    [HttpGet("balances/summary")]
    public async Task<IActionResult> GetBalanceSummary([FromQuery] int year, [FromQuery] int? asOfMonth = null)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Read") == "Own")
            return Forbid();
        var asOfDate = ResolveAsOfDate(year, asOfMonth);
        if (asOfMonth.HasValue && asOfDate is null)
            return BadRequest(new { message = "asOfMonth must be between 1 and 12." });
        return Ok(await _leaveService.GetBalanceSummaryAsync(year, asOfDate));
    }

    [HttpPost("balances")]
    public async Task<IActionResult> CreateBalance([FromBody] CreateLeaveBalanceDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        try
        {
            var result = await _leaveService.CreateLeaveBalanceAsync(dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("balances/{id:guid}")]
    public async Task<IActionResult> UpdateBalance(Guid id, [FromBody] UpdateLeaveBalanceDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var result = await _leaveService.UpdateLeaveBalanceAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("carry-forward")]
    [HttpPost("process-carry-forward")]
    public async Task<IActionResult> ProcessCarryForward([FromBody] CarryForwardRequest request)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        try
        {
            IReadOnlySet<Guid>? filter = request.EmployeeIds is null
                ? null
                : request.EmployeeIds.Count == 0
                    ? new HashSet<Guid>()
                    : request.EmployeeIds.ToHashSet();
            var result = await _leaveService.ProcessCarryForwardAsync(request.FromYear, request.ToYear, filter);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpGet("carry-forward-availability")]
    public async Task<IActionResult> GetCarryForwardAvailability()
    {
        if (!LeaveAccessHelper.CanReadCarryForwardAvailabilitySettings(User))
            return Forbid();
        return Ok(await _leaveService.GetCarryForwardAvailabilitySettingsAsync());
    }

    [HttpPut("carry-forward-availability")]
    public async Task<IActionResult> SetCarryForwardAvailability([FromBody] UpdateCarryForwardAvailabilitySettingsDto dto)
    {
        if (!LeaveAccessHelper.CanUpdateCarryForwardAvailabilitySettings(User))
            return Forbid();
        if (dto is null) return BadRequest();
        if (dto.AvailabilityMonths is < 1 or > 12)
            return BadRequest(new { message = "AvailabilityMonths must be between 1 and 12." });
        return Ok(await _leaveService.SetCarryForwardAvailabilitySettingsAsync(dto));
    }

    // ───── Holidays ─────

    [HttpGet("holidays")]
    public async Task<IActionResult> GetHolidays([FromQuery] int year, [FromQuery] string? country = null)
        => Ok(await _leaveService.GetHolidaysAsync(year, country));

    [HttpGet("holidays/locale")]
    public async Task<IActionResult> GetHolidayLocale()
        => Ok(await _leaveService.GetHolidayLocaleSettingsAsync());

    [HttpPut("holidays/locale")]
    public async Task<IActionResult> SetHolidayLocale([FromBody] UpdateHolidayLocaleSettingsDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        return Ok(await _leaveService.SetHolidayLocaleSettingsAsync(dto));
    }

    [HttpPost("holidays")]
    public async Task<IActionResult> CreateHoliday([FromBody] CreateHolidayDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Create") != "All")
            return Forbid();
        return Ok(await _leaveService.CreateHolidayAsync(dto));
    }

    [HttpPut("holidays/{id:guid}")]
    public async Task<IActionResult> UpdateHoliday(Guid id, [FromBody] UpdateHolidayDto dto)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var result = await _leaveService.UpdateHolidayAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("holidays/{id:guid}")]
    public async Task<IActionResult> DeleteHoliday(Guid id)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Delete") != "All")
            return Forbid();
        return await _leaveService.DeleteHolidayAsync(id) ? NoContent() : NotFound();
    }

    // ───── Entitlement & Recalculate ─────

    /// <summary>Shop &amp; Office Act baseline entitlements for the calendar year (continuous service; ignores probation/permanency).</summary>
    [HttpGet("shop-office-entitlement/{employeeId:guid}")]
    public async Task<IActionResult> GetShopOfficeEntitlement(Guid employeeId, [FromQuery] int year = 0)
    {
        if (!await LeaveAccessHelper.CanAccessEmployeeLeaveAsync(User, _db, employeeId, "Read"))
            return Forbid();
        var y = year == 0 ? DateTime.UtcNow.Year : year;
        var dto = await _entitlementService.GetShopOfficeActEntitlementAsync(employeeId, y);
        if (dto is null) return NotFound();
        return Ok(new
        {
            annual_leave_entitlement = dto.AnnualLeaveEntitlement,
            casual_leave_entitlement = dto.CasualLeaveEntitlement,
            year = dto.Year,
            based_on = dto.BasedOn,
        });
    }

    [HttpPost("recalculate/{employeeId:guid}")]
    public async Task<IActionResult> Recalculate(Guid employeeId, [FromQuery] int year)
    {
        if (!await LeaveAccessHelper.CanAccessEmployeeLeaveAsync(User, _db, employeeId, "Update"))
            return Forbid();
        var y0 = year == 0 ? DateTime.UtcNow.Year : year;
        var years = new SortedSet<int> { y0, DateTime.UtcNow.Year };
        EntitlementResult sum = new(0, 0);
        foreach (var y in years)
        {
            var r = await _entitlementService.CalculateAndApplyAsync(employeeId, y);
            sum = new(sum.BalancesCreated + r.BalancesCreated, sum.BalancesUpdated + r.BalancesUpdated);
        }
        return Ok(sum);
    }

    [HttpPost("recalculate-all")]
    public async Task<IActionResult> RecalculateAll([FromQuery] int year)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        return Ok(await _entitlementService.RecalculateAllAsync(year == 0 ? DateTime.UtcNow.Year : year));
    }

    [HttpGet("entitlement-rules")]
    public async Task<IActionResult> GetEntitlementRules()
    {
        if (LeaveAccessHelper.ResolveScope(User, "Read") != "All")
            return Forbid();
        return Ok(await _entitlementService.GetRulesAsync());
    }

    [HttpPost("entitlement-rules")]
    public async Task<IActionResult> CreateEntitlementRule([FromBody] CreateRuleRequest request)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Create") != "All")
            return Forbid();
        return Ok(await _entitlementService.CreateRuleAsync(request.LeaveTypeId, request.RuleType, request.RuleConfig));
    }

    [HttpPut("entitlement-rules/{id:guid}")]
    public async Task<IActionResult> UpdateEntitlementRule(Guid id, [FromBody] UpdateRuleRequest request)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Update") != "All")
            return Forbid();
        var result = await _entitlementService.UpdateRuleAsync(id, request.RuleConfig);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("entitlement-rules/{id:guid}")]
    public async Task<IActionResult> DeleteEntitlementRule(Guid id)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Delete") != "All")
            return Forbid();
        return await _entitlementService.DeleteRuleAsync(id) ? NoContent() : NotFound();
    }

    public record CreateRuleRequest(Guid LeaveTypeId, string RuleType, string RuleConfig);
    public record UpdateRuleRequest(string RuleConfig);

    // ───── Calendar ─────

    [HttpGet("calendar")]
    public async Task<IActionResult> GetCalendar([FromQuery] int month, [FromQuery] int year, [FromQuery] Guid? departmentId = null)
    {
        if (LeaveAccessHelper.ResolveScope(User, "Read") != "All")
            return Forbid();
        return Ok(await _leaveService.GetCalendarAsync(month, year, departmentId));
    }

    private static DateTime? ResolveAsOfDate(int year, int? asOfMonth)
    {
        if (!asOfMonth.HasValue)
            return null;
        if (asOfMonth is < 1 or > 12)
            return null;
        var m = asOfMonth.Value;
        var day = DateTime.DaysInMonth(year, m);
        return new DateTime(year, m, day);
    }
}
