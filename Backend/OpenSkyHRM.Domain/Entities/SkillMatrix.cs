using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class SkillMatrix : AuditableEntity
{
    public int ProficiencyLevel { get; set; }
    public string? Notes { get; set; }
    public DateTime? AssessedAt { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid SkillId { get; set; }
    public Skill Skill { get; set; } = null!;
}
