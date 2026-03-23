using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Recruitment;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class OffboardingService : IOffboardingService
{
    private readonly AppDbContext _db;
    public OffboardingService(AppDbContext db) { _db = db; }

    // ── Per-employee tasks ──────────────────────────────────────────

    public async Task<List<OffboardingTaskDto>> GetTasksByEmployeeAsync(Guid employeeId)
    {
        return await _db.OffboardingTasks
            .Include(t => t.Employee)
            .Include(t => t.AssignedToUser)
            .Where(t => t.EmployeeId == employeeId)
            .OrderBy(t => t.SortOrder)
            .Select(t => new OffboardingTaskDto
            {
                Id = t.Id, Title = t.Title, Category = t.Category, IsCompleted = t.IsCompleted,
                DueDate = t.DueDate, CompletedAt = t.CompletedAt,
                EmployeeName = t.Employee.FirstName + " " + t.Employee.LastName,
                EmployeeId = t.EmployeeId,
                AssignmentType = t.AssignmentType,
                AssignedToUserId = t.AssignedToUserId,
                AssignedToUserName = t.AssignedToUser != null ? t.AssignedToUser.Username : null,
            }).ToListAsync();
    }

    public async Task<OffboardingTaskDto?> CompleteTaskAsync(Guid taskId)
    {
        var task = await _db.OffboardingTasks
            .Include(t => t.Employee)
            .Include(t => t.AssignedToUser)
            .FirstOrDefaultAsync(t => t.Id == taskId);
        if (task is null) return null;
        task.IsCompleted = true;
        task.CompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var allDone = !await _db.OffboardingTasks
            .AnyAsync(t => t.EmployeeId == task.EmployeeId && !t.IsCompleted);

        if (allDone)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == task.EmployeeId);
            if (user is not null)
            {
                user.IsActive = false;
                await _db.SaveChangesAsync();
            }
        }

        return new OffboardingTaskDto
        {
            Id = task.Id, Title = task.Title, Category = task.Category, IsCompleted = true,
            DueDate = task.DueDate, CompletedAt = task.CompletedAt,
            EmployeeName = task.Employee.FirstName + " " + task.Employee.LastName,
            EmployeeId = task.EmployeeId,
            AssignmentType = task.AssignmentType,
            AssignedToUserId = task.AssignedToUserId,
            AssignedToUserName = task.AssignedToUser?.Username,
        };
    }

    public async Task CreateDefaultTasksAsync(Guid employeeId, List<Guid>? templateIds = null)
    {
        IList<OffboardingTaskTemplate> templates;

        if (templateIds is { Count: > 0 })
        {
            templates = await _db.OffboardingTaskTemplates
                .Where(t => templateIds.Contains(t.Id) && !t.IsDeleted)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();
        }
        else
        {
            templates = await _db.OffboardingTaskTemplates
                .Where(t => t.IsActive && !t.IsDeleted)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();
        }

        Guid? supervisorUserId = null;
        var needsSupervisor = templates.Any(t => t.AssignmentType == "Supervisor");
        if (needsSupervisor)
        {
            var sup = await _db.EmployeeSupervisors
                .Where(s => s.EmployeeId == employeeId && !s.IsDeleted)
                .Select(s => s.SupervisorId)
                .FirstOrDefaultAsync();
            if (sup != Guid.Empty)
                supervisorUserId = (await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == sup && !u.IsDeleted))?.Id;
        }

        foreach (var tpl in templates)
        {
            var resolvedUserId = tpl.AssignmentType == "Supervisor"
                ? supervisorUserId
                : tpl.AssignedToUserId;

            _db.OffboardingTasks.Add(new OffboardingTask
            {
                Title = tpl.Title,
                Description = tpl.Description,
                Category = tpl.Category,
                SortOrder = tpl.SortOrder,
                EmployeeId = employeeId,
                AssignmentType = tpl.AssignmentType,
                AssignedToUserId = resolvedUserId,
            });
        }

        await _db.SaveChangesAsync();
    }

    // ── Templates CRUD ──────────────────────────────────────────────

    public async Task<List<OffboardingTaskTemplateDto>> GetTemplatesAsync()
    {
        return await _db.OffboardingTaskTemplates
            .Where(t => !t.IsDeleted)
            .Include(t => t.AssignedToUser)
            .OrderBy(t => t.SortOrder)
            .Select(t => new OffboardingTaskTemplateDto
            {
                Id = t.Id, Title = t.Title, Description = t.Description,
                Category = t.Category, SortOrder = t.SortOrder, IsActive = t.IsActive,
                AssignmentType = t.AssignmentType,
                AssignedToUserId = t.AssignedToUserId,
                AssignedToUserName = t.AssignedToUser != null ? t.AssignedToUser.Username : null,
            }).ToListAsync();
    }

    public async Task<OffboardingTaskTemplateDto> CreateTemplateAsync(CreateOffboardingTaskTemplateDto dto)
    {
        var entity = new OffboardingTaskTemplate
        {
            Title = dto.Title, Description = dto.Description,
            Category = dto.Category, SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
            AssignmentType = dto.AssignmentType,
            AssignedToUserId = dto.AssignmentType == "Supervisor" ? null : dto.AssignedToUserId,
        };
        _db.OffboardingTaskTemplates.Add(entity);
        await _db.SaveChangesAsync();

        var user = entity.AssignedToUserId.HasValue
            ? await _db.Users.FindAsync(entity.AssignedToUserId.Value)
            : null;

        return new OffboardingTaskTemplateDto
        {
            Id = entity.Id, Title = entity.Title, Description = entity.Description,
            Category = entity.Category, SortOrder = entity.SortOrder, IsActive = entity.IsActive,
            AssignmentType = entity.AssignmentType,
            AssignedToUserId = entity.AssignedToUserId,
            AssignedToUserName = user?.Username,
        };
    }

    public async Task<OffboardingTaskTemplateDto?> UpdateTemplateAsync(Guid id, CreateOffboardingTaskTemplateDto dto)
    {
        var entity = await _db.OffboardingTaskTemplates.FindAsync(id);
        if (entity is null || entity.IsDeleted) return null;

        entity.Title = dto.Title;
        entity.Description = dto.Description;
        entity.Category = dto.Category;
        entity.SortOrder = dto.SortOrder;
        entity.IsActive = dto.IsActive;
        entity.AssignmentType = dto.AssignmentType;
        entity.AssignedToUserId = dto.AssignmentType == "Supervisor" ? null : dto.AssignedToUserId;
        await _db.SaveChangesAsync();

        var user = entity.AssignedToUserId.HasValue
            ? await _db.Users.FindAsync(entity.AssignedToUserId.Value)
            : null;

        return new OffboardingTaskTemplateDto
        {
            Id = entity.Id, Title = entity.Title, Description = entity.Description,
            Category = entity.Category, SortOrder = entity.SortOrder, IsActive = entity.IsActive,
            AssignmentType = entity.AssignmentType,
            AssignedToUserId = entity.AssignedToUserId,
            AssignedToUserName = user?.Username,
        };
    }

    public async Task<bool> DeleteTemplateAsync(Guid id)
    {
        var entity = await _db.OffboardingTaskTemplates.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Active offboardings ─────────────────────────────────────────

    public async Task<List<ActiveOffboardingDto>> GetActiveOffboardingsAsync()
    {
        var employeeIds = await _db.OffboardingTasks
            .Where(t => !t.IsDeleted)
            .Select(t => t.EmployeeId)
            .Distinct()
            .ToListAsync();

        var result = new List<ActiveOffboardingDto>();

        foreach (var empId in employeeIds)
        {
            var emp = await _db.Employees
                .Include(e => e.Department)
                .FirstOrDefaultAsync(e => e.Id == empId);
            if (emp is null) continue;

            var tasks = await _db.OffboardingTasks
                .Include(t => t.AssignedToUser)
                .Where(t => t.EmployeeId == empId && !t.IsDeleted)
                .OrderBy(t => t.SortOrder)
                .ToListAsync();

            result.Add(new ActiveOffboardingDto
            {
                EmployeeId = empId,
                EmployeeName = emp.FirstName + " " + emp.LastName,
                EmployeeCode = emp.EmployeeCode,
                DepartmentName = emp.Department?.Name,
                TerminationReason = emp.TerminationReason,
                TerminationDate = emp.TerminationDate,
                TotalTasks = tasks.Count,
                CompletedTasks = tasks.Count(t => t.IsCompleted),
                Tasks = tasks.Select(t => new OffboardingTaskDto
                {
                    Id = t.Id, Title = t.Title, Category = t.Category,
                    IsCompleted = t.IsCompleted, DueDate = t.DueDate, CompletedAt = t.CompletedAt,
                    EmployeeName = emp.FirstName + " " + emp.LastName,
                    EmployeeId = empId,
                    AssignmentType = t.AssignmentType,
                    AssignedToUserId = t.AssignedToUserId,
                    AssignedToUserName = t.AssignedToUser?.Username,
                }).ToList(),
            });
        }

        return result;
    }
}
