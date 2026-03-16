namespace OpenSkyHRM.Application.DTOs.Settings;

public class SecurityRoleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsSystemRole { get; set; }
    public int PermissionCount { get; set; }
}

public class AuditLogDto
{
    public Guid Id { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public DateTime Timestamp { get; set; }
}

public class WorkflowDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public int Steps { get; set; }
    public bool IsActive { get; set; }
}
