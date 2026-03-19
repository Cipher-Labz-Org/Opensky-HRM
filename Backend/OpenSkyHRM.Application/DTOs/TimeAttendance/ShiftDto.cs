namespace OpenSkyHRM.Application.DTOs.TimeAttendance;

public class ShiftPatternDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string ShiftType { get; set; } = "Regular";
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public decimal BreakHours { get; set; }
    public bool IsNightShift { get; set; }
    public TimeSpan? Session2StartTime { get; set; }
    public TimeSpan? Session2EndTime { get; set; }
    public TimeSpan? FlexiWindowStart { get; set; }
    public TimeSpan? FlexiWindowEnd { get; set; }
    public decimal? MinimumWorkHours { get; set; }
    public int LateGraceMinutes { get; set; }
    public int EarlyDepartureGraceMinutes { get; set; }
    public int HalfDayHours { get; set; }
    public bool IsActive { get; set; }
}

public class CreateShiftPatternDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string ShiftType { get; set; } = "Regular";
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public decimal BreakHours { get; set; }
    public bool IsNightShift { get; set; }
    public TimeSpan? Session2StartTime { get; set; }
    public TimeSpan? Session2EndTime { get; set; }
    public TimeSpan? FlexiWindowStart { get; set; }
    public TimeSpan? FlexiWindowEnd { get; set; }
    public decimal? MinimumWorkHours { get; set; }
    public int LateGraceMinutes { get; set; } = 5;
    public int EarlyDepartureGraceMinutes { get; set; } = 5;
    public int HalfDayHours { get; set; } = 4;
    public bool IsActive { get; set; } = true;
}

public class UpdateShiftPatternDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string ShiftType { get; set; } = "Regular";
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public decimal BreakHours { get; set; }
    public bool IsNightShift { get; set; }
    public TimeSpan? Session2StartTime { get; set; }
    public TimeSpan? Session2EndTime { get; set; }
    public TimeSpan? FlexiWindowStart { get; set; }
    public TimeSpan? FlexiWindowEnd { get; set; }
    public decimal? MinimumWorkHours { get; set; }
    public int LateGraceMinutes { get; set; } = 5;
    public int EarlyDepartureGraceMinutes { get; set; } = 5;
    public int HalfDayHours { get; set; } = 4;
    public bool IsActive { get; set; }
}
