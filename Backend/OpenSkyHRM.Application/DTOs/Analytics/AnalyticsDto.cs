namespace OpenSkyHRM.Application.DTOs.Analytics;

public class HeadcountAnalyticsDto
{
    public int TotalEmployees { get; set; }
    public int ActiveEmployees { get; set; }
    public int OnLeave { get; set; }
    public int Terminated { get; set; }
    public int Probation { get; set; }
    public Dictionary<string, int> ByDepartment { get; set; } = new();
    public Dictionary<string, int> ByBusinessUnit { get; set; } = new();
}

public class ReportDefinitionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string OutputFormat { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

/// <summary>Maps dashboard tiles to tabular reports (category/key + optional filter query for RunReportAsync).</summary>
public class AnalyticsDrillDownLinkDto
{
    public string KpiId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string ReportCategory { get; set; } = string.Empty;
    public string ReportKey { get; set; } = string.Empty;
    /// <summary>Query string fragment e.g. month=3&amp;year=2026 for reports that accept filters.</summary>
    public string? QueryHint { get; set; }
}

public class WorkforceHealthDriverDto
{
    public string MetricId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    /// <summary>Approximate adverse contribution 0–1 used to rank drivers (higher = more concern).</summary>
    public double AdverseWeight { get; set; }
    public string? ValueLabel { get; set; }
}

public class WorkforceHealthIndexDto
{
    /// <summary>0–100; higher is healthier workforce operations.</summary>
    public int Score { get; set; }
    public IReadOnlyList<WorkforceHealthDriverDto> TopDrivers { get; set; } = Array.Empty<WorkforceHealthDriverDto>();
}

public class ComplianceDebtBucketDto
{
    public string BucketId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class ComplianceDebtSummaryDto
{
    public int TotalItems { get; set; }
    public IReadOnlyList<ComplianceDebtBucketDto> ImmigrationExpiryBuckets { get; set; } = Array.Empty<ComplianceDebtBucketDto>();
    public int OverdueOnboardingTasks { get; set; }
    public int PendingLeaveApprovals { get; set; }
}

public class TalentVelocityDto
{
    public int OpenRequisitions { get; set; }
    public double? AverageDaysOpenForOpenReqs { get; set; }
    public int ActiveCandidatesInPipeline { get; set; }
    public double? AverageDaysToFillClosedReqs { get; set; }
}

public class PayrollMonthSummaryDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string PeriodLabel { get; set; } = string.Empty;
    public decimal TotalNetPay { get; set; }
    public decimal TotalGrossPay { get; set; }
    public int StatementCount { get; set; }
}

public class HeadcountMovementMonthDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string PeriodLabel { get; set; } = string.Empty;
    public int Joiners { get; set; }
    public int Terminations { get; set; }
}

public class AttendancePulseDto
{
    public int AbsentMarkedDaysLast14 { get; set; }
    public int ActiveEmployeesBaseline { get; set; }
}

/// <summary>v1 executive analytics payload (aggregates only; drill-down via reports).</summary>
public class ExecutiveDashboardDto
{
    public DateTime GeneratedAtUtc { get; set; }
    public HeadcountAnalyticsDto Headcount { get; set; } = new();
    public WorkforceHealthIndexDto WorkforceHealth { get; set; } = new();
    public ComplianceDebtSummaryDto ComplianceDebt { get; set; } = new();
    public TalentVelocityDto TalentVelocity { get; set; } = new();
    public IReadOnlyList<PayrollMonthSummaryDto> PayrollLastMonths { get; set; } = Array.Empty<PayrollMonthSummaryDto>();
    public IReadOnlyList<HeadcountMovementMonthDto> HeadcountMovementTrend { get; set; } = Array.Empty<HeadcountMovementMonthDto>();
    public AttendancePulseDto AttendancePulse { get; set; } = new();
    public IReadOnlyList<AnalyticsDrillDownLinkDto> DrillDown { get; set; } = Array.Empty<AnalyticsDrillDownLinkDto>();

    /// <summary>Set when served from nightly cache.</summary>
    public DateTime? SnapshotCapturedAtUtc { get; set; }
}
