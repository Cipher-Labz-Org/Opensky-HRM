using System.Globalization;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Settings;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class SettingsService : ISettingsService
{
    private readonly AppDbContext _db;
    private readonly IBusinessClock _clock;

    public SettingsService(AppDbContext db, IBusinessClock clock)
    {
        _db = db;
        _clock = clock;
    }

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
                Id = a.Id,
                Module = a.Module,
                SubjectEmployeeId = a.SubjectEmployeeId,
                EntityName = a.EntityName,
                EntityId = a.EntityId,
                Action = a.Action,
                UserName = a.UserName,
                Timestamp = a.Timestamp,
            }).ToListAsync();
        return new PagedResult<AuditLogDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<PagedResult<OutboundEmailLogDto>> GetOutboundEmailLogsAsync(int page = 1, int pageSize = 50, string? status = null)
    {
        var query = _db.OutboundEmailLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(x => x.Status == status);

        var total = await query.CountAsync();
        var rows = await query.OrderByDescending(x => x.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Legacy rows store CreatedAt as Sri Lanka wall clock; new rows (CreatedAtIsUtc) store UTC.
        var items = rows.Select(x => new OutboundEmailLogDto
        {
            Id = x.Id,
            CreatedAt = x.CreatedAt,
            CreatedAtColombo = FormatEmailLogCreatedAtColombo(x),
            Category = x.Category,
            RecipientEmail = x.RecipientEmail,
            RecipientName = x.RecipientName,
            Subject = x.Subject,
            Status = x.Status,
            Provider = x.Provider,
            HttpStatusCode = x.HttpStatusCode,
            FromEmail = x.FromEmail,
            ErrorDetail = x.ErrorDetail,
        }).ToList();

        return new PagedResult<OutboundEmailLogDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    private string FormatEmailLogCreatedAtColombo(OutboundEmailLog row)
    {
        if (row.CreatedAtIsUtc)
        {
            return _clock.ToBusinessLocal(DateTime.SpecifyKind(row.CreatedAt, DateTimeKind.Utc))
                .ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
        }

        return row.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);
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
