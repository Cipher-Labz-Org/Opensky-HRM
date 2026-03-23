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

    // Day-of-week applicability (true = shift applies on this day)
    public bool AppliesOnMonday { get; set; } = true;
    public bool AppliesOnTuesday { get; set; } = true;
    public bool AppliesOnWednesday { get; set; } = true;
    public bool AppliesOnThursday { get; set; } = true;
    public bool AppliesOnFriday { get; set; } = true;
    public bool AppliesOnSaturday { get; set; } = false;
    public bool AppliesOnSunday { get; set; } = false;

    // Optional per-day start/end times. When both set, override default StartTime/EndTime for that day (e.g. 7h or 4h days).
    public TimeSpan? MondayStartTime { get; set; }
    public TimeSpan? MondayEndTime { get; set; }
    public TimeSpan? TuesdayStartTime { get; set; }
    public TimeSpan? TuesdayEndTime { get; set; }
    public TimeSpan? WednesdayStartTime { get; set; }
    public TimeSpan? WednesdayEndTime { get; set; }
    public TimeSpan? ThursdayStartTime { get; set; }
    public TimeSpan? ThursdayEndTime { get; set; }
    public TimeSpan? FridayStartTime { get; set; }
    public TimeSpan? FridayEndTime { get; set; }
    public TimeSpan? SaturdayStartTime { get; set; }
    public TimeSpan? SaturdayEndTime { get; set; }
    public TimeSpan? SundayStartTime { get; set; }
    public TimeSpan? SundayEndTime { get; set; }

    public bool IsActive { get; set; } = true;
}
