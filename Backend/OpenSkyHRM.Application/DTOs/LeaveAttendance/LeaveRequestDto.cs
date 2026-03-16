namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

public class LeaveRequestDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public Guid EmployeeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? CoveragePerson { get; set; }
    public string? ApproverRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateLeaveRequestDto
{
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string? Reason { get; set; }
    public string? CoveragePerson { get; set; }
}

public class ApproveRejectLeaveDto
{
    public string? Remarks { get; set; }
}

public class LeaveTypeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; }
    public bool IsActive { get; set; }
}

public class LeaveBalanceDto
{
    public Guid Id { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public int Year { get; set; }
    public decimal Entitled { get; set; }
    public decimal Used { get; set; }
    public decimal CarriedForward { get; set; }
    public decimal Remaining { get; set; }
}

public class HolidayDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public bool IsRestricted { get; set; }
    public int Year { get; set; }
}

public class CreateHolidayDto
{
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
}
