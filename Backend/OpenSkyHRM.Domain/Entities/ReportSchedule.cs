using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ReportSchedule : AuditableEntity
{
    public string CronExpression { get; set; } = string.Empty;
    public string? Recipients { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }

    public Guid ReportDefinitionId { get; set; }
    public ReportDefinition ReportDefinition { get; set; } = null!;
}
