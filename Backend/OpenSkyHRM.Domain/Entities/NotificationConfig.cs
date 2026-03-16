using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class NotificationConfig : AuditableEntity
{
    public string EventType { get; set; } = string.Empty;
    public string Channel { get; set; } = "Email";
    public string? TemplateBody { get; set; }
    public bool IsActive { get; set; } = true;
}
