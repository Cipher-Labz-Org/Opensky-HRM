using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ReportDefinition : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? QueryTemplate { get; set; }
    public string OutputFormat { get; set; } = "PDF";
    public bool IsActive { get; set; } = true;
}
