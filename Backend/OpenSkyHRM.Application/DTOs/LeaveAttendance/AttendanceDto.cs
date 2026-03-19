namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

public class AttendanceRecordDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public Guid EmployeeId { get; set; }
    public DateTime Date { get; set; }
    public DateTime? PunchIn { get; set; }
    public DateTime? PunchOut { get; set; }
    public decimal? WorkedHours { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public string? Source { get; set; }
    public string? ShiftName { get; set; }
    public TimeSpan? ExpectedStart { get; set; }
    public TimeSpan? ExpectedEnd { get; set; }
    public bool IsLate { get; set; }
    public int LateMins { get; set; }
    public bool IsEarlyDeparture { get; set; }
    public int EarlyDepartureMins { get; set; }
    public bool IsShortHours { get; set; }
    /// <summary>True when the employee had approved leave for this date; no attendance expectation applied.</summary>
    public bool IsOnLeave { get; set; }
    public string? ShiftType { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public class CreateAttendanceRecordDto
{
    public Guid EmployeeId { get; set; }
    public DateTime Date { get; set; }
    public DateTime? PunchIn { get; set; }
    public DateTime? PunchOut { get; set; }
    public string Status { get; set; } = "Present";
    public string? Remarks { get; set; }
    public string? Source { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public class UpdateAttendanceRecordDto
{
    public DateTime? PunchIn { get; set; }
    public DateTime? PunchOut { get; set; }
    public string? Status { get; set; }
    public string? Remarks { get; set; }
}

public class AttendanceSummaryDto
{
    public int TotalPresent { get; set; }
    public int TotalAbsent { get; set; }
    public int TotalLate { get; set; }
    public int TotalNoPunch { get; set; }
    public decimal AverageWorkHours { get; set; }
}

public class PunchRequestDto
{
    public string Type { get; set; } = "in";
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}

public class OvertimeNopayResultDto
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public decimal TotalWorkedHours { get; set; }
    public decimal ExpectedHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public int NopayDays { get; set; }
    public decimal NopayHours { get; set; }
    public int LateDays { get; set; }
    public int PresentDays { get; set; }
    public int AbsentDays { get; set; }
}
