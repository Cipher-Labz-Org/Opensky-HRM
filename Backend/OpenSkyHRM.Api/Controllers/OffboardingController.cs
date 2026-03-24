using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Offboarding")]
[Route("api/[controller]")]
public class OffboardingController : ControllerBase
{
    private readonly IOffboardingService _svc;
    private readonly AppDbContext _db;

    public OffboardingController(IOffboardingService svc, AppDbContext db)
    {
        _svc = svc;
        _db = db;
    }

    // ── Per-employee tasks ───────────────────────────────────────

    [HttpGet("{employeeId:guid}/tasks")]
    public async Task<IActionResult> GetTasks(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();
        return Ok(await _svc.GetTasksByEmployeeAsync(employeeId));
    }

    [HttpPost("tasks/{taskId:guid}/complete")]
    public async Task<IActionResult> CompleteTask(Guid taskId)
    {
        var task = await _db.OffboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return NotFound();

        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        Guid.TryParse(sub, out var currentUserId);

        var isAssignee = task.AssignedToUserId.HasValue && task.AssignedToUserId.Value == currentUserId;
        if (!isAssignee && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, task.EmployeeId, "Update"))
            return Forbid();

        var result = await _svc.CompleteTaskAsync(taskId);
        return result is null ? NotFound() : Ok(result);
    }

    // ── Templates CRUD ───────────────────────────────────────────

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates()
    {
        return Ok(await _svc.GetTemplatesAsync());
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateOffboardingTaskTemplateDto dto)
    {
        var created = await _svc.CreateTemplateAsync(dto);
        return Ok(created);
    }

    [HttpPut("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] CreateOffboardingTaskTemplateDto dto)
    {
        var updated = await _svc.UpdateTemplateAsync(id, dto);
        return updated is null ? NotFound() : Ok(updated);
    }

    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
    {
        return await _svc.DeleteTemplateAsync(id) ? NoContent() : NotFound();
    }

    [HttpPut("tasks/{taskId:guid}/assign")]
    public async Task<IActionResult> AssignTask(Guid taskId, [FromBody] AssignTaskRequest req)
    {
        var task = await _db.OffboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, task.EmployeeId, "Update"))
            return Forbid();
        task.AssignedToUserId = req.AssignedToUserId;
        await _db.SaveChangesAsync();
        return Ok(new { task.Id, task.AssignedToUserId });
    }

    // ── My assigned tasks (for the logged-in user) ──────────────

    [HttpGet("my-tasks")]
    public async Task<IActionResult> GetMyTasks()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(sub, out var userId)) return Unauthorized();

        var tasks = await _db.OffboardingTasks
            .Include(t => t.Employee)
            .Where(t => t.AssignedToUserId == userId && !t.IsCompleted && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Category,
                t.IsCompleted,
                t.DueDate,
                t.AssignmentType,
                EmployeeId = t.EmployeeId,
                EmployeeName = t.Employee.FirstName + " " + t.Employee.LastName,
                EmployeeCode = t.Employee.EmployeeCode,
            })
            .ToListAsync();

        return Ok(tasks);
    }

    // ── Active offboardings ──────────────────────────────────────

    [HttpGet("active")]
    public async Task<IActionResult> GetActive()
    {
        return Ok(await _svc.GetActiveOffboardingsAsync());
    }

    // ── Users lookup (for assignee dropdown) ─────────────────────

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _db.Users
            .Include(u => u.Employee).ThenInclude(e => e!.Department)
            .Where(u => !u.IsDeleted && u.IsActive)
            .OrderBy(u => u.Username)
            .Select(u => new
            {
                u.Id,
                u.Username,
                EmployeeName = u.Employee != null ? u.Employee.FirstName + " " + u.Employee.LastName : null,
                DepartmentName = u.Employee != null && u.Employee.Department != null ? u.Employee.Department.Name : null,
            })
            .ToListAsync();
        return Ok(users);
    }
}

public class AssignTaskRequest
{
    public Guid? AssignedToUserId { get; set; }
}
