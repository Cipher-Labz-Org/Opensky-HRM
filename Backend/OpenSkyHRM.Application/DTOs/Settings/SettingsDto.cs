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
    public string Module { get; set; } = string.Empty;
    public Guid? SubjectEmployeeId { get; set; }
    public string EntityName { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
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

public class OutboundEmailLogDto
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>CreatedAt converted to Sri Lanka (Asia/Colombo) for display: yyyy-MM-dd HH:mm:ss.</summary>
    public string CreatedAtColombo { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public string? RecipientName { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public int? HttpStatusCode { get; set; }
    public string? FromEmail { get; set; }
    public string? ErrorDetail { get; set; }
}
