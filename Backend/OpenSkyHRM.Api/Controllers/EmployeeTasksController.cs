using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.DTOs;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("EmployeeTasks")]
[Route("api/employee-tasks")]
public class EmployeeTasksController : ControllerBase
{
    private readonly IEmployeeTaskService _svc;
    private readonly AppDbContext _db;

    public EmployeeTasksController(IEmployeeTaskService svc, AppDbContext db)
    {
        _svc = svc;
        _db = db;
    }

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates([FromQuery] string? type = null)
        => Ok(await _svc.GetTemplatesAsync(type));

    [HttpGet("templates/{id:guid}")]
    public async Task<IActionResult> GetTemplate(Guid id)
    {
        var result = await _svc.GetTemplateByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateEmployeeTaskTemplateDto dto)
        => Ok(await _svc.CreateTemplateAsync(dto));

    [HttpPut("templates/{id:guid}")]
    public async Task<IActionResult> UpdateTemplate(Guid id, [FromBody] CreateEmployeeTaskTemplateDto dto)
    {
        var result = await _svc.UpdateTemplateAsync(id, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("templates/{id:guid}")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
        => await _svc.DeleteTemplateAsync(id) ? NoContent() : NotFound();

    [HttpPost("templates/{templateId:guid}/items")]
    public async Task<IActionResult> AddItem(Guid templateId, [FromBody] CreateEmployeeTaskTemplateItemDto dto)
        => Ok(await _svc.AddItemAsync(templateId, dto));

    [HttpPut("items/{itemId:guid}")]
    public async Task<IActionResult> UpdateItem(Guid itemId, [FromBody] CreateEmployeeTaskTemplateItemDto dto)
    {
        var result = await _svc.UpdateItemAsync(itemId, dto);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpDelete("items/{itemId:guid}")]
    public async Task<IActionResult> DeleteItem(Guid itemId)
        => await _svc.DeleteItemAsync(itemId) ? NoContent() : NotFound();

    [HttpGet("lookup")]
    public async Task<IActionResult> Lookup([FromQuery] string type = "Offboarding")
        => Ok(await _svc.GetTemplateLookupAsync(type));

    [HttpPost("create-from-template")]
    public async Task<IActionResult> CreateFromTemplate([FromBody] CreateFromTemplateRequest req)
    {
        await _svc.CreateTasksFromTemplateAsync(req.EmployeeId, req.TemplateId, req.TaskType);
        return Ok(new { success = true });
    }

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

    [HttpGet("my-tasks")]
    public async Task<IActionResult> GetMyTasks()
    {
        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        if (!Guid.TryParse(sub, out var userId)) return Unauthorized();

        var offboarding = await _db.OffboardingTasks
            .Include(t => t.Employee)
            .Where(t => t.AssignedToUserId == userId && !t.IsCompleted && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .Select(t => new
            {
                t.Id, t.Title, t.Category, t.IsCompleted, t.DueDate, t.AssignmentType,
                TaskType = "Offboarding",
                EmployeeId = t.EmployeeId,
                EmployeeName = t.Employee.FirstName + " " + t.Employee.LastName,
                EmployeeCode = t.Employee.EmployeeCode,
            }).ToListAsync();

        var onboarding = await _db.OnboardingTasks
            .Include(t => t.Employee)
            .Where(t => t.AssignedToUserId == userId && !t.IsCompleted && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .Select(t => new
            {
                t.Id, t.Title, t.Category, t.IsCompleted, t.DueDate, t.AssignmentType,
                TaskType = "Onboarding",
                EmployeeId = t.EmployeeId,
                EmployeeName = t.Employee.FirstName + " " + t.Employee.LastName,
                EmployeeCode = t.Employee.EmployeeCode,
            }).ToListAsync();

        var all = offboarding.Cast<object>().Concat(onboarding.Cast<object>()).ToList();
        return Ok(all);
    }

    // ── Onboarding per-employee tasks ────────────────────────────

    [HttpGet("onboarding/{employeeId:guid}/tasks")]
    public async Task<IActionResult> GetOnboardingTasks(Guid employeeId)
    {
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employeeId, "Read"))
            return Forbid();

        var tasks = await _db.OnboardingTasks
            .Include(t => t.AssignedToUser)
            .Where(t => t.EmployeeId == employeeId && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .Select(t => new
            {
                t.Id, t.Title, t.Description, t.Category,
                t.IsCompleted, t.CompletedAt, t.DueDate, t.SortOrder,
                t.AssignmentType, t.AssignedToUserId,
                AssignedToUserName = t.AssignedToUser != null ? t.AssignedToUser.Username : null,
            }).ToListAsync();

        return Ok(tasks);
    }

    [HttpPost("onboarding/tasks/{taskId:guid}/complete")]
    public async Task<IActionResult> CompleteOnboardingTask(Guid taskId)
    {
        var task = await _db.OnboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId && !t.IsDeleted);
        if (task is null) return NotFound();

        var sub = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("sub")?.Value;
        Guid.TryParse(sub, out var currentUserId);

        var isAssignee = task.AssignedToUserId.HasValue && task.AssignedToUserId.Value == currentUserId;
        if (!isAssignee && !await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, task.EmployeeId, "Update"))
            return Forbid();

        task.IsCompleted = true;
        task.CompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { task.Id, task.IsCompleted, task.CompletedAt });
    }

    [HttpPut("onboarding/tasks/{taskId:guid}/assign")]
    public async Task<IActionResult> AssignOnboardingTask(Guid taskId, [FromBody] AssignOnboardingTaskRequest req)
    {
        var task = await _db.OnboardingTasks.FirstOrDefaultAsync(t => t.Id == taskId && !t.IsDeleted);
        if (task is null) return NotFound();
        if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, task.EmployeeId, "Update"))
            return Forbid();
        task.AssignedToUserId = req.AssignedToUserId;
        await _db.SaveChangesAsync();
        return Ok(new { task.Id, task.AssignedToUserId });
    }

    // ── Active onboardings ───────────────────────────────────────

    [HttpGet("onboarding/active")]
    public async Task<IActionResult> GetActiveOnboardings()
    {
        var employeeIds = await _db.OnboardingTasks
            .Where(t => !t.IsCompleted && !t.IsDeleted)
            .Select(t => t.EmployeeId)
            .Distinct()
            .ToListAsync();

        var result = new List<object>();
        foreach (var empId in employeeIds)
        {
            var emp = await _db.Employees.FirstOrDefaultAsync(e => e.Id == empId && !e.IsDeleted);
            if (emp is null) continue;

            var tasks = await _db.OnboardingTasks
                .Include(t => t.AssignedToUser)
                .Where(t => t.EmployeeId == empId && !t.IsDeleted)
                .OrderBy(t => t.SortOrder)
                .Select(t => new
                {
                    t.Id, t.Title, t.Description, t.Category,
                    t.IsCompleted, t.CompletedAt, t.DueDate, t.SortOrder,
                    t.AssignmentType, t.AssignedToUserId,
                    AssignedToUserName = t.AssignedToUser != null ? t.AssignedToUser.Username : null,
                }).ToListAsync();

            result.Add(new
            {
                EmployeeId = empId,
                EmployeeName = emp.FirstName + " " + emp.LastName,
                EmployeeCode = emp.EmployeeCode,
                TotalTasks = tasks.Count,
                CompletedTasks = tasks.Count(t => t.IsCompleted),
                Tasks = tasks,
            });
        }

        return Ok(result);
    }
}

public class AssignOnboardingTaskRequest
{
    public Guid? AssignedToUserId { get; set; }
}

public class CreateFromTemplateRequest
{
    public Guid EmployeeId { get; set; }
    public Guid TemplateId { get; set; }
    public string TaskType { get; set; } = "Onboarding";
}
