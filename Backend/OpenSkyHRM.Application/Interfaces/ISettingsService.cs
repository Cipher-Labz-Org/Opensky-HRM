using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Settings;

namespace OpenSkyHRM.Application.Interfaces;

public interface ISettingsService
{
    Task<List<SecurityRoleDto>> GetRolesAsync();
    Task<PagedResult<AuditLogDto>> GetAuditLogsAsync(int page = 1, int pageSize = 50);
    Task<PagedResult<OutboundEmailLogDto>> GetOutboundEmailLogsAsync(int page = 1, int pageSize = 50, string? status = null);
    Task<List<WorkflowDto>> GetWorkflowsAsync();
}
