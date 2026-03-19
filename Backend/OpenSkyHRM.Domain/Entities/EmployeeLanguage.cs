using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeLanguage : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Language { get; set; } = string.Empty;
    public string Skill { get; set; } = string.Empty;
    public string FluencyLevel { get; set; } = string.Empty;
    public string? Comments { get; set; }
}
