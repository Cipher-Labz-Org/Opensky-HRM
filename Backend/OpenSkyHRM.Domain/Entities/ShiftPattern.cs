using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ShiftPattern : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public decimal BreakHours { get; set; }
    public bool IsNightShift { get; set; }
    public bool IsActive { get; set; } = true;
}
