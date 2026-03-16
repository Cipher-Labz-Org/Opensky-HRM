using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class IntegrationConfig : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Provider { get; set; } = string.Empty;
    public string? ApiUrl { get; set; }
    public string? ApiKey { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastSyncAt { get; set; }
}
