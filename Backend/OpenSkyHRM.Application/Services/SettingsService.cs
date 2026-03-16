using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Settings;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class SettingsService : ISettingsService
{
    private readonly AppDbContext _db;
    public SettingsService(AppDbContext db) { _db = db; }

    public async Task<List<SecurityRoleDto>> GetRolesAsync()
    {
        return await _db.SecurityRoles.Include(r => r.Permissions).OrderBy(r => r.Name)
            .Select(r => new SecurityRoleDto
            {
                Id = r.Id, Name = r.Name, Code = r.Code,
                IsSystemRole = r.IsSystemRole, PermissionCount = r.Permissions.Count,
            }).ToListAsync();
    }

    public async Task<PagedResult<AuditLogDto>> GetAuditLogsAsync(int page = 1, int pageSize = 50)
    {
        var query = _db.AuditLogs.AsQueryable();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(a => a.Timestamp).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new AuditLogDto
            {
                Id = a.Id, EntityName = a.EntityName, Action = a.Action,
                UserName = a.UserName, Timestamp = a.Timestamp,
            }).ToListAsync();
        return new PagedResult<AuditLogDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<List<WorkflowDto>> GetWorkflowsAsync()
    {
        return await _db.ApprovalWorkflows.OrderBy(w => w.Module)
            .Select(w => new WorkflowDto
            {
                Id = w.Id, Name = w.Name, Module = w.Module, Steps = w.Steps, IsActive = w.IsActive,
            }).ToListAsync();
    }
}
