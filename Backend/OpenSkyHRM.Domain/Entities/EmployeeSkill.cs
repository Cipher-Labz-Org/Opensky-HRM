using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeSkill : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Skill { get; set; } = string.Empty;
    public string? YearsOfExperience { get; set; }
    public string? Comments { get; set; }
}
