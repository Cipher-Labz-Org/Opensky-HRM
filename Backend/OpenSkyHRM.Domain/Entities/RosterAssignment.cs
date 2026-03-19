using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class RosterAssignment : AuditableEntity
{
    public DateTime EffectiveFrom { get; set; }
    public DateTime? EffectiveTo { get; set; }
    public string? Notes { get; set; }

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid RosterTemplateId { get; set; }
    public RosterTemplate RosterTemplate { get; set; } = null!;
}
