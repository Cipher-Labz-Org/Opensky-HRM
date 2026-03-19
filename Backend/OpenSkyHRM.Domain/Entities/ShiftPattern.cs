using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ShiftPattern : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string ShiftType { get; set; } = "Regular";

    // Regular / Rotational / Split session-1 times
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public decimal BreakHours { get; set; }
    public bool IsNightShift { get; set; }

    // Split shift: second session
    public TimeSpan? Session2StartTime { get; set; }
    public TimeSpan? Session2EndTime { get; set; }

    // Flexi shift: allowed window + minimum work
    public TimeSpan? FlexiWindowStart { get; set; }
    public TimeSpan? FlexiWindowEnd { get; set; }
    public decimal? MinimumWorkHours { get; set; }

    // Per-shift attendance rules
    public int LateGraceMinutes { get; set; } = 5;
    public int EarlyDepartureGraceMinutes { get; set; } = 5;
    public int HalfDayHours { get; set; } = 4;

    public bool IsActive { get; set; } = true;
}
