namespace OpenSkyHRM.Application.DTOs.TimeAttendance;

public class BiometricDeviceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

public class CreateBiometricDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = "Fingerprint";
    public bool IsActive { get; set; } = true;
}

public class UpdateBiometricDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = "Fingerprint";
    public bool IsActive { get; set; } = true;
}

public class PunchImportBatchDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; }
    public int TotalRecords { get; set; }
    public int SuccessCount { get; set; }
    public int FailCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorDetails { get; set; }
    public Guid DeviceId { get; set; }
    public string? DeviceName { get; set; }
}

public class PunchImportRowDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public DateTime PunchTime { get; set; }
    public string? Direction { get; set; }
}

public class AdmsProcessResultDto
{
    public int Processed { get; set; }
    public int SkippedUnmapped { get; set; }
    public int Failed { get; set; }
}

public class BiometricDayRebuildResult
{
    public int Rebuilt { get; set; }
    public List<DateTime> SkippedManualDays { get; set; } = new();
}

public class PunchTimeRepairSampleDto
{
    public string DeviceUserId { get; set; } = string.Empty;
    public string? EmployeeCode { get; set; }
    public string? EmployeeName { get; set; }
    public DateTime? StoredTime { get; set; }
    public DateTime CorrectTime { get; set; }
    public string Action { get; set; } = string.Empty;
}

public class PunchTimeRepairMonthDto
{
    public string Month { get; set; } = string.Empty;
    public int Corrected { get; set; }
    public int DuplicatesRemoved { get; set; }
    public int Inserted { get; set; }
}

public class PunchTimeRepairReportDto
{
    public bool DryRun { get; set; }
    public int RawEventsScanned { get; set; }
    public int RawEventsUnreadable { get; set; }
    public int PunchesUnchanged { get; set; }
    public int PunchesCorrected { get; set; }
    public int DuplicatesRemoved { get; set; }
    public int PunchesInserted { get; set; }
    public int PunchesNotInPayload { get; set; }
    public int PunchesWithoutRawEvent { get; set; }
    public int AttendanceDaysRebuilt { get; set; }
    public int ManualDaysSkipped { get; set; }
    public List<PunchTimeRepairMonthDto> ByMonth { get; set; } = new();
    public List<PunchTimeRepairSampleDto> Samples { get; set; } = new();
}

/// <summary>
/// Fingerprint taps from one device that arrived inside the window were recorded with a wrong
/// device clock. <see cref="OffsetMinutes"/> is added to each tap time.
/// </summary>
public class DeviceClockCorrectionDto
{
    public Guid DeviceId { get; set; }
    public DateTime ReceivedFromUtc { get; set; }
    public DateTime ReceivedToUtc { get; set; }
    public int OffsetMinutes { get; set; }
    public string? Note { get; set; }
    public DateTime? SavedAtUtc { get; set; }
}

public class ClockDiagnosticDayDto
{
    public string DeviceSerial { get; set; } = string.Empty;
    public string ReceivedDate { get; set; } = string.Empty;
    public int Punches { get; set; }
    public int LivePunches { get; set; }
    public int MedianLagMinutes { get; set; }
    public string TopLagBuckets { get; set; } = string.Empty;
}

public class ClockDiagnosticPunchDto
{
    public string DeviceSerial { get; set; } = string.Empty;
    public string DeviceUserId { get; set; } = string.Empty;
    public DateTime PunchTime { get; set; }
    public DateTime ReceivedAtLocal { get; set; }
    public int LagMinutes { get; set; }
}

public class ClockDiagnosticsDto
{
    public int RawEventsScanned { get; set; }
    public List<ClockDiagnosticDayDto> Days { get; set; } = new();
    public List<ClockDiagnosticPunchDto> Punches { get; set; } = new();
}

public class AdmsPipelineStatusDto
{
    public string ServerTimeZone { get; set; } =
        $"{TimeZoneInfo.Local.Id} (UTC{(TimeZoneInfo.Local.BaseUtcOffset < TimeSpan.Zero ? "-" : "+")}{TimeZoneInfo.Local.BaseUtcOffset:hh\\:mm})";
    public int DeviceCount { get; set; }
    public DateTime? LatestDeviceSyncAt { get; set; }
    public DateTime? LatestRawEventAt { get; set; }
    public string? LatestRawParseStatus { get; set; }
    public int RawEventsSinceAug4 { get; set; }
    public int RawParseFailuresSinceAug4 { get; set; }
    public DateTime? LatestPunchAt { get; set; }
    public int UnprocessedPunchCount { get; set; }
    public int PunchesSinceAug4 { get; set; }
    public DateTime? LatestBiometricAttendanceDate { get; set; }
    public int BiometricAttendanceSinceAug4 { get; set; }
    public int UnmappedPunchCount { get; set; }
    public IReadOnlyList<string> SampleUnmappedDeviceUserIds { get; set; } = Array.Empty<string>();
    /// <summary>ingestion | parse | processing | mapping | healthy | empty</summary>
    public string BreakPoint { get; set; } = "empty";
    public string Summary { get; set; } = string.Empty;
    public string WebhookPath { get; set; } = "/api/biometric/adms/logs";
    public string? RecommendedWebhookUrl { get; set; }
}
