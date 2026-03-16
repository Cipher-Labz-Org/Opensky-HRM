namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

public class AttendanceRecordDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public Guid EmployeeId { get; set; }
    public DateTime Date { get; set; }
    public DateTime? PunchIn { get; set; }
    public DateTime? PunchOut { get; set; }
    public decimal? WorkedHours { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
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
}

public class AttendanceSummaryDto
{
    public int TotalPresent { get; set; }
    public int TotalAbsent { get; set; }
    public int TotalLate { get; set; }
    public int TotalNoPunch { get; set; }
    public decimal AverageWorkHours { get; set; }
}
