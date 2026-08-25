using System.Text.Json.Serialization;
using OpenSkyHRM.Domain.Entities;

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
    public string DurationKind { get; set; } = "FullDay";
    public string? HalfDayPeriod { get; set; }
    public int? ShortLeaveHours { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? CoveragePerson { get; set; }
    public string? ApproverRemarks { get; set; }
    public DateTime CreatedAt { get; set; }

    public int CurrentApprovalLevel { get; set; }
    public Guid? Level1ApproverId { get; set; }
    public string? Level1ApproverName { get; set; }
    public string? Level1Remarks { get; set; }
    public DateTime? Level1ApprovedAt { get; set; }
    public Guid? Level2ApproverId { get; set; }
    public string? Level2ApproverName { get; set; }
    public string? Level2Remarks { get; set; }
    public DateTime? Level2ApprovedAt { get; set; }
    public string? ApproverName { get; set; }
    /// <summary>Who is responsible: approver/rejector name, or who needs to approve for Pending states.</summary>
    public string? ResponsibleUserName { get; set; }
    /// <summary>Employee ID of the responsible approver (for Pending / PendingLevel2).</summary>
    public Guid? ResponsibleEmployeeId { get; set; }

    /// <summary>Relative URL to a stored medical certificate PDF, when applicable.</summary>
    public string? MedicalCertificateUrl { get; set; }
}

public class CreateLeaveRequestDto
{
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string? DurationKind { get; set; }
    public string? HalfDayPeriod { get; set; }
    public int? ShortLeaveHours { get; set; }
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
    public string? Description { get; set; }
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; }
    public bool IsActive { get; set; }
    public bool AllowHalfDay { get; set; }
    public bool AllowShortLeave { get; set; }
    public int ShortLeaveHours { get; set; }
    public int? MinHours { get; set; }
    public int? MaxHours { get; set; }
    public decimal? MinDays { get; set; }
    public decimal? MaxDays { get; set; }
}

public class CreateLeaveTypeDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public bool AllowHalfDay { get; set; }
    public bool AllowShortLeave { get; set; }
    public int ShortLeaveHours { get; set; } = 3;
    public int? MinHours { get; set; }
    public int? MaxHours { get; set; }
    public decimal? MinDays { get; set; }
    public decimal? MaxDays { get; set; }
}

public class UpdateLeaveTypeDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DefaultDaysPerYear { get; set; }
    public bool IsPaid { get; set; }
    public bool IsActive { get; set; }
    public bool AllowHalfDay { get; set; }
    public bool AllowShortLeave { get; set; }
    public int ShortLeaveHours { get; set; } = 3;
    public int? MinHours { get; set; }
    public int? MaxHours { get; set; }
    public decimal? MinDays { get; set; }
    public decimal? MaxDays { get; set; }
}

public class LeavePolicyDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxDaysPerYear { get; set; }
    public bool AllowCarryForward { get; set; }
    public int MaxCarryForwardDays { get; set; }
    public bool AllowEncashment { get; set; }
    public bool RequiresApproval { get; set; }
    public Guid LeaveTypeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
}

public class CreateLeavePolicyDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxDaysPerYear { get; set; }
    public bool AllowCarryForward { get; set; }
    public int MaxCarryForwardDays { get; set; }
    public bool AllowEncashment { get; set; }
    public bool RequiresApproval { get; set; } = true;
    public Guid LeaveTypeId { get; set; }
}

public class UpdateLeavePolicyDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxDaysPerYear { get; set; }
    public bool AllowCarryForward { get; set; }
    public int MaxCarryForwardDays { get; set; }
    public bool AllowEncashment { get; set; }
    public bool RequiresApproval { get; set; }
    public Guid LeaveTypeId { get; set; }
}

public class LeaveBalanceDto
{
    public Guid Id { get; set; }
    public Guid LeaveTypeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public int Year { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    /// <summary>Display label for the period, e.g. "2025" or "1 Apr 2025 – 31 Mar 2026".</summary>
    public string PeriodLabel { get; set; } = string.Empty;
    public decimal Entitled { get; set; }
    public decimal Used { get; set; }
    public decimal CarriedForward { get; set; }
    public decimal BroughtForwardDays { get; set; }
    public decimal Remaining { get; set; }
}

public class CreateLeaveBalanceDto
{
    public Guid EmployeeId { get; set; }
    public Guid LeaveTypeId { get; set; }
    /// <summary>When set (non-null), use as calendar year (Jan 1 – Dec 31). When null, PeriodStart/PeriodEnd define the period.</summary>
    public int? Year { get; set; }
    public DateTime? PeriodStart { get; set; }
    public DateTime? PeriodEnd { get; set; }
    public decimal Entitled { get; set; }
    public decimal Used { get; set; }
    public decimal CarriedForward { get; set; }
}

public class UpdateLeaveBalanceDto
{
    public decimal Entitled { get; set; }
    public decimal Used { get; set; }
    public decimal CarriedForward { get; set; }
}

public class CarryForwardRequest
{
    [JsonPropertyName("fromYear")]
    public int FromYear { get; set; }
    [JsonPropertyName("toYear")]
    public int ToYear { get; set; }
    /// <summary>When set, only these employees are included. When null, all employees with source-year balances are processed. An empty list processes no one.</summary>
    [JsonPropertyName("employeeIds")]
    public List<Guid>? EmployeeIds { get; set; }
}

public class CarryForwardResult
{
    public int FromYear { get; set; }
    public int ToYear { get; set; }
    public int BalancesProcessed { get; set; }
    public int BalancesUpdated { get; set; }
    public int BalancesCreated { get; set; }
    public decimal TotalDaysCarried { get; set; }
    /// <summary>Non-error hint when the run is a no-op (e.g. no policies, nothing to carry).</summary>
    public string? InfoMessage { get; set; }
}

public class CarryForwardAvailabilitySettingsDto
{
    [JsonPropertyName("availabilityMonths")]
    public int AvailabilityMonths { get; set; }
    [JsonPropertyName("windowDescription")]
    public string WindowDescription { get; set; } = string.Empty;
    /// <summary>Intro line(s) for the policy reference. Same values returned for editing (defaults applied when not stored).</summary>
    [JsonPropertyName("narrativeIntro")]
    public string NarrativeIntro { get; set; } = string.Empty;
    [JsonPropertyName("narrativePoints")]
    public List<string> NarrativePoints { get; set; } = new();
}

public class UpdateCarryForwardAvailabilitySettingsDto
{
    [JsonPropertyName("availabilityMonths")]
    public int AvailabilityMonths { get; set; }
    [JsonPropertyName("narrativeIntro")]
    public string? NarrativeIntro { get; set; }
    [JsonPropertyName("narrativePoints")]
    public string[]? NarrativePoints { get; set; }
}

public class LeaveBalanceSummaryDto
{
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public List<LeaveBalanceDto> Balances { get; set; } = new();
}

public class HolidayDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string Kind { get; set; } = HolidayKinds.Public;
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
    public string CountryCode { get; set; } = HolidayCountryCodes.LK;
}

public class CreateHolidayDto
{
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? Kind { get; set; }
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
}

public class UpdateHolidayDto
{
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string? Kind { get; set; }
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
}

public class HolidayLocaleSettingsDto
{
    public string CountryCode { get; set; } = HolidayCountryCodes.LK;
    public string TimeZoneId { get; set; } = "Asia/Colombo";
    public List<HolidayLocaleOptionDto> Countries { get; set; } = new();
    public List<HolidayTimeZoneOptionDto> TimeZones { get; set; } = new();
}

public class HolidayLocaleOptionDto
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class HolidayTimeZoneOptionDto
{
    public string Id { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string CountryCode { get; set; } = string.Empty;
}

public class UpdateHolidayLocaleSettingsDto
{
    public string CountryCode { get; set; } = HolidayCountryCodes.LK;
    public string TimeZoneId { get; set; } = "Asia/Colombo";
}

public class CalendarDayDto
{
    public DateTime Date { get; set; }
    public List<CalendarEntryDto> Entries { get; set; } = new();
}

public class CalendarEntryDto
{
    public string EmployeeName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class LeaveDashboardDto
{
    public int TotalRequests { get; set; }
    public int PendingApprovals { get; set; }
    public int ApprovedThisMonth { get; set; }
    public int UpcomingHolidays { get; set; }
    public int ActiveLeaveTypes { get; set; }
    public List<LeaveRequestDto> RecentRequests { get; set; } = new();
}
