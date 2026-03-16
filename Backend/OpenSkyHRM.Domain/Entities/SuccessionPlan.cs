using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class SuccessionPlan : AuditableEntity
{
    public string? Readiness { get; set; }
    public string? DevelopmentPlan { get; set; }
    public string? Notes { get; set; }

    public Guid PositionId { get; set; }
    public Position Position { get; set; } = null!;

    public Guid SuccessorId { get; set; }
    public Employee Successor { get; set; } = null!;
}
