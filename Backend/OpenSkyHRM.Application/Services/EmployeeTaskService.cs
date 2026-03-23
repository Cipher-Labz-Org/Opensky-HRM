using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class EmployeeTaskService : IEmployeeTaskService
{
    private readonly AppDbContext _db;

    public EmployeeTaskService(AppDbContext db) => _db = db;

    public async Task<List<EmployeeTaskTemplateDto>> GetTemplatesAsync(string? type = null)
    {
        var query = _db.EmployeeTaskTemplates
            .Where(t => !t.IsDeleted)
            .Include(t => t.Items.Where(i => !i.IsDeleted))
                .ThenInclude(i => i.AssignedToUser)
            .AsQueryable();

        if (!string.IsNullOrEmpty(type))
            query = query.Where(t => t.Type == type);

        return await query
            .OrderBy(t => t.Type).ThenBy(t => t.Name)
            .Select(t => new EmployeeTaskTemplateDto
            {
                Id = t.Id,
                Name = t.Name,
                Description = t.Description,
                Type = t.Type,
                IsActive = t.IsActive,
                ItemCount = t.Items.Count(i => !i.IsDeleted),
                Items = t.Items.Where(i => !i.IsDeleted).OrderBy(i => i.SortOrder).Select(i => new EmployeeTaskTemplateItemDto
                {
                    Id = i.Id,
                    Title = i.Title,
                    Description = i.Description,
                    Category = i.Category,
                    SortOrder = i.SortOrder,
                    AssignmentType = i.AssignmentType,
                    AssignedToUserId = i.AssignedToUserId,
                    AssignedToUserName = i.AssignedToUser != null ? i.AssignedToUser.Username : null,
                }).ToList(),
            }).ToListAsync();
    }

    public async Task<EmployeeTaskTemplateDto?> GetTemplateByIdAsync(Guid id)
    {
        return (await GetTemplatesAsync()).FirstOrDefault(t => t.Id == id);
    }

    public async Task<EmployeeTaskTemplateDto> CreateTemplateAsync(CreateEmployeeTaskTemplateDto dto)
    {
        var entity = new EmployeeTaskTemplate
        {
            Name = dto.Name,
            Description = dto.Description,
            Type = dto.Type,
            IsActive = dto.IsActive,
        };
        _db.EmployeeTaskTemplates.Add(entity);
        await _db.SaveChangesAsync();

        return new EmployeeTaskTemplateDto
        {
            Id = entity.Id, Name = entity.Name, Description = entity.Description,
            Type = entity.Type, IsActive = entity.IsActive, ItemCount = 0, Items = new(),
        };
    }

    public async Task<EmployeeTaskTemplateDto?> UpdateTemplateAsync(Guid id, CreateEmployeeTaskTemplateDto dto)
    {
        var entity = await _db.EmployeeTaskTemplates.FindAsync(id);
        if (entity is null || entity.IsDeleted) return null;

        entity.Name = dto.Name;
        entity.Description = dto.Description;
        entity.Type = dto.Type;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();

        return await GetTemplateByIdAsync(id);
    }

    public async Task<bool> DeleteTemplateAsync(Guid id)
    {
        var entity = await _db.EmployeeTaskTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id);
        if (entity is null || entity.IsDeleted) return false;

        entity.IsDeleted = true;
        foreach (var item in entity.Items) item.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<EmployeeTaskTemplateItemDto> AddItemAsync(Guid templateId, CreateEmployeeTaskTemplateItemDto dto)
    {
        var entity = new EmployeeTaskTemplateItem
        {
            TemplateId = templateId,
            Title = dto.Title,
            Description = dto.Description,
            Category = dto.Category,
            SortOrder = dto.SortOrder,
            AssignmentType = dto.AssignmentType,
            AssignedToUserId = dto.AssignmentType == "Supervisor" ? null : dto.AssignedToUserId,
        };
        _db.EmployeeTaskTemplateItems.Add(entity);
        await _db.SaveChangesAsync();

        var user = entity.AssignedToUserId.HasValue
            ? await _db.Users.FindAsync(entity.AssignedToUserId.Value) : null;

        return new EmployeeTaskTemplateItemDto
        {
            Id = entity.Id, Title = entity.Title, Description = entity.Description,
            Category = entity.Category, SortOrder = entity.SortOrder,
            AssignmentType = entity.AssignmentType,
            AssignedToUserId = entity.AssignedToUserId,
            AssignedToUserName = user?.Username,
        };
    }

    public async Task<EmployeeTaskTemplateItemDto?> UpdateItemAsync(Guid itemId, CreateEmployeeTaskTemplateItemDto dto)
    {
        var entity = await _db.EmployeeTaskTemplateItems
            .Include(i => i.AssignedToUser)
            .FirstOrDefaultAsync(i => i.Id == itemId && !i.IsDeleted);
        if (entity is null) return null;

        entity.Title = dto.Title;
        entity.Description = dto.Description;
        entity.Category = dto.Category;
        entity.SortOrder = dto.SortOrder;
        entity.AssignmentType = dto.AssignmentType;
        entity.AssignedToUserId = dto.AssignmentType == "Supervisor" ? null : dto.AssignedToUserId;
        await _db.SaveChangesAsync();

        var user = entity.AssignedToUserId.HasValue
            ? await _db.Users.FindAsync(entity.AssignedToUserId.Value) : null;

        return new EmployeeTaskTemplateItemDto
        {
            Id = entity.Id, Title = entity.Title, Description = entity.Description,
            Category = entity.Category, SortOrder = entity.SortOrder,
            AssignmentType = entity.AssignmentType,
            AssignedToUserId = entity.AssignedToUserId,
            AssignedToUserName = user?.Username,
        };
    }

    public async Task<bool> DeleteItemAsync(Guid itemId)
    {
        var entity = await _db.EmployeeTaskTemplateItems.FindAsync(itemId);
        if (entity is null || entity.IsDeleted) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task CreateTasksFromTemplateAsync(Guid employeeId, Guid templateId, string taskType)
    {
        var items = await _db.EmployeeTaskTemplateItems
            .Where(i => i.TemplateId == templateId && !i.IsDeleted)
            .OrderBy(i => i.SortOrder)
            .ToListAsync();

        Guid? supervisorUserId = null;
        if (items.Any(i => i.AssignmentType == "Supervisor"))
        {
            var sup = await _db.EmployeeSupervisors
                .Where(s => s.EmployeeId == employeeId && !s.IsDeleted)
                .Select(s => s.SupervisorId)
                .FirstOrDefaultAsync();
            if (sup != Guid.Empty)
                supervisorUserId = (await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == sup && !u.IsDeleted))?.Id;
        }

        foreach (var item in items)
        {
            var resolvedUserId = item.AssignmentType == "Supervisor" ? supervisorUserId : item.AssignedToUserId;

            if (taskType == "Offboarding")
            {
                _db.OffboardingTasks.Add(new OffboardingTask
                {
                    Title = item.Title, Description = item.Description,
                    Category = item.Category, SortOrder = item.SortOrder,
                    EmployeeId = employeeId,
                    AssignmentType = item.AssignmentType,
                    AssignedToUserId = resolvedUserId,
                });
            }
            else
            {
                _db.OnboardingTasks.Add(new OnboardingTask
                {
                    Title = item.Title, Description = item.Description,
                    Category = item.Category, SortOrder = item.SortOrder,
                    EmployeeId = employeeId,
                    AssignmentType = item.AssignmentType,
                    AssignedToUserId = resolvedUserId,
                });
            }
        }

        await _db.SaveChangesAsync();
    }

    public async Task<List<EmployeeTaskLookupDto>> GetTemplateLookupAsync(string type)
    {
        return await _db.EmployeeTaskTemplates
            .Where(t => !t.IsDeleted && t.IsActive && t.Type == type)
            .OrderBy(t => t.Name)
            .Select(t => new EmployeeTaskLookupDto
            {
                Id = t.Id, Name = t.Name, Type = t.Type,
                ItemCount = t.Items.Count(i => !i.IsDeleted),
            }).ToListAsync();
    }
}
