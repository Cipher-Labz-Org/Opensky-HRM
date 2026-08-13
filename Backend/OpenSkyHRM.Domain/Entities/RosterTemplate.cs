using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class RosterTemplate : AuditableEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public TimeSpan DefaultStartTime { get; set; }
    public TimeSpan DefaultEndTime { get; set; }
    public decimal WorkHoursPerDay { get; set; }
    public bool IsActive { get; set; } = true;

    public Guid? DefaultShiftPatternId { get; set; }
    public ShiftPattern? DefaultShiftPattern { get; set; }
}
