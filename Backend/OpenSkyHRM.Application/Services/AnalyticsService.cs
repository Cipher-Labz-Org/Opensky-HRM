using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Analytics;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AnalyticsService : IAnalyticsService
{
    private readonly AppDbContext _db;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    public AnalyticsService(AppDbContext db) => _db = db;

    /// <summary>Matches tabular reports: working population excludes Terminated.</summary>
    private static bool IsActiveWorkforce(string status) =>
        !string.Equals(status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase);

    private static bool IsTerminated(string status) =>
        string.Equals(status, nameof(EmployeeStatus.Terminated), StringComparison.OrdinalIgnoreCase);

    public async Task<HeadcountAnalyticsDto> GetHeadcountAnalyticsAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var employeeQuery = _db.Employees.AsNoTracking().AsQueryable();
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                employeeQuery = employeeQuery.Where(_ => false);
            else
                employeeQuery = employeeQuery.Where(e => allowedEmployeeIds.Contains(e.Id));
        }

        var rows = await employeeQuery
            .Select(e => new
            {
                e.Status,
                e.EmploymentType,
                DepartmentName = e.Department.Name,
                BusinessUnitName = e.BusinessUnit != null ? e.BusinessUnit.Name : null,
            })
            .ToListAsync(cancellationToken);

        var leaveQuery = _db.LeaveRequests
            .AsNoTracking()
            .Where(r => !r.IsDeleted
                        && r.Status == ApprovalStatus.Approved
                        && r.StartDate.Date <= today
                        && r.EndDate.Date >= today);
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                leaveQuery = leaveQuery.Where(_ => false);
            else
                leaveQuery = leaveQuery.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));
        }

        var onLeave = await leaveQuery
            .Select(r => r.EmployeeId)
            .Distinct()
            .CountAsync(cancellationToken);

        return new HeadcountAnalyticsDto
        {
            TotalEmployees = rows.Count,
            ActiveEmployees = rows.Count(r => IsActiveWorkforce(r.Status)),
            OnLeave = onLeave,
            Terminated = rows.Count(r => IsTerminated(r.Status)),
            Probation = rows.Count(r =>
                string.Equals(r.EmploymentType, nameof(EmploymentType.FullTimeProbation), StringComparison.OrdinalIgnoreCase)),
            ByDepartment = rows
                .Where(r => IsActiveWorkforce(r.Status))
                .GroupBy(r => r.DepartmentName ?? "Unassigned")
                .ToDictionary(g => g.Key, g => g.Count()),
            ByBusinessUnit = rows
                .Where(r => IsActiveWorkforce(r.Status) && r.BusinessUnitName != null)
                .GroupBy(r => r.BusinessUnitName!)
                .ToDictionary(g => g.Key, g => g.Count()),
        };
    }

    public Task<List<ReportDefinitionDto>> GetReportsAsync(CancellationToken cancellationToken = default) =>
        _db.ReportDefinitions.AsNoTracking()
            .Where(r => r.IsActive)
            .OrderBy(r => r.Category)
            .ThenBy(r => r.Name)
            .Select(r => new ReportDefinitionDto
            {
                Id = r.Id,
                Name = r.Name,
                Category = r.Category,
                Description = r.Description,
                OutputFormat = r.OutputFormat,
                IsActive = r.IsActive,
            })
            .ToListAsync(cancellationToken);

    public async Task<ExecutiveDashboardDto> GetExecutiveDashboardAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        CancellationToken cancellationToken = default)
    {
        var dto = await BuildExecutiveDashboardCoreAsync(allowedEmployeeIds, cancellationToken);
        dto.GeneratedAtUtc = DateTime.UtcNow;
        dto.SnapshotCapturedAtUtc = null;
        return dto;
    }

    public async Task<ExecutiveDashboardDto?> GetCachedExecutiveDashboardAsync(CancellationToken cancellationToken = default)
    {
        var row = await _db.AnalyticsSnapshotCaches.AsNoTracking()
            .FirstOrDefaultAsync(x => x.CacheKey == AnalyticsSnapshotCache.ExecutiveDashboardKey, cancellationToken);
        if (row is null || string.IsNullOrWhiteSpace(row.PayloadJson))
            return null;
        try
        {
            var dto = JsonSerializer.Deserialize<ExecutiveDashboardDto>(row.PayloadJson, JsonOpts);
            if (dto != null)
                dto.SnapshotCapturedAtUtc = row.CapturedAtUtc;
            return dto;
        }
        catch
        {
            return null;
        }
    }

    public async Task RefreshExecutiveDashboardSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var dto = await BuildExecutiveDashboardCoreAsync(allowedEmployeeIds: null, cancellationToken);
        dto.GeneratedAtUtc = DateTime.UtcNow;
        dto.SnapshotCapturedAtUtc = null;
        var json = JsonSerializer.Serialize(dto, JsonOpts);
        var now = DateTime.UtcNow;
        var existing = await _db.AnalyticsSnapshotCaches
            .FirstOrDefaultAsync(x => x.CacheKey == AnalyticsSnapshotCache.ExecutiveDashboardKey, cancellationToken);
        if (existing is null)
        {
            _db.AnalyticsSnapshotCaches.Add(new AnalyticsSnapshotCache
            {
                CacheKey = AnalyticsSnapshotCache.ExecutiveDashboardKey,
                PayloadJson = json,
                CapturedAtUtc = now,
            });
        }
        else
        {
            existing.PayloadJson = json;
            existing.CapturedAtUtc = now;
            existing.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<ExecutiveDashboardDto> BuildExecutiveDashboardCoreAsync(
        IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken)
    {
        var headcount = await GetHeadcountAnalyticsAsync(allowedEmployeeIds, cancellationToken);
        var active = Math.Max(headcount.ActiveEmployees, 1);
        var today = DateTime.UtcNow.Date;
        var in90 = today.AddDays(90);

        var termCutoff = today.AddDays(-90);
        var termQuery = _db.Employees.AsNoTracking()
            .Where(e => e.Status == nameof(EmployeeStatus.Terminated) && e.TerminationDate >= termCutoff);
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                termQuery = termQuery.Where(_ => false);
            else
                termQuery = termQuery.Where(e => allowedEmployeeIds.Contains(e.Id));
        }

        var terminations90 = await termQuery.CountAsync(cancellationToken);

        var pendingLeaveQuery = _db.LeaveRequests.AsNoTracking()
            .Where(r => !r.IsDeleted
                        && (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2));
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                pendingLeaveQuery = pendingLeaveQuery.Where(_ => false);
            else
                pendingLeaveQuery = pendingLeaveQuery.Where(r => allowedEmployeeIds.Contains(r.EmployeeId));
        }

        var pendingLeaveApprovals = await pendingLeaveQuery.CountAsync(cancellationToken);

        var immQuery = _db.Immigrations.AsNoTracking().Where(i => !i.IsDeleted && i.ExpiryDate != null);
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                immQuery = immQuery.Where(_ => false);
            else
                immQuery = immQuery.Where(i => allowedEmployeeIds.Contains(i.EmployeeId));
        }
        var immSoon = await immQuery.CountAsync(i => i.ExpiryDate <= in90, cancellationToken);
        var immOverdue = await immQuery.CountAsync(i => i.ExpiryDate < today, cancellationToken);
        var imm30 = await immQuery.CountAsync(i => i.ExpiryDate >= today && i.ExpiryDate <= today.AddDays(30), cancellationToken);
        var imm31_90 = await immQuery.CountAsync(i => i.ExpiryDate > today.AddDays(30) && i.ExpiryDate <= in90, cancellationToken);

        var onboardingQuery = _db.OnboardingTasks.AsNoTracking()
            .Where(t => !t.IsDeleted && !t.IsCompleted && t.DueDate != null && t.DueDate < today);
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                onboardingQuery = onboardingQuery.Where(_ => false);
            else
                onboardingQuery = onboardingQuery.Where(t => allowedEmployeeIds.Contains(t.EmployeeId));
        }

        var onboardingOverdue = await onboardingQuery.CountAsync(cancellationToken);

        // Strains 0–1 (higher = more operational risk)
        var strainTerm = Math.Min(1d, terminations90 / Math.Max(active * 0.05, 1));
        var strainLeave = Math.Min(1d, pendingLeaveApprovals / Math.Max(active * 0.02, 1));
        var strainImm = Math.Min(1d, immSoon / Math.Max(active * 0.05, 1));
        var strainOnb = Math.Min(1d, onboardingOverdue / Math.Max(active * 0.02, 1));
        var weighted = 0.35 * strainTerm + 0.25 * strainLeave + 0.25 * strainImm + 0.15 * strainOnb;
        var score = (int)Math.Clamp(Math.Round(100 * (1 - weighted)), 0, 100);

        var driverCandidates = new[]
        {
            new WorkforceHealthDriverDto
            {
                MetricId = "terminations_90d",
                Label = "Terminations (90d)",
                AdverseWeight = strainTerm,
                ValueLabel = $"{terminations90} / {active} active",
            },
            new WorkforceHealthDriverDto
            {
                MetricId = "pending_leave_approvals",
                Label = "Pending leave approvals",
                AdverseWeight = strainLeave,
                ValueLabel = pendingLeaveApprovals.ToString(),
            },
            new WorkforceHealthDriverDto
            {
                MetricId = "immigration_expiry",
                Label = "Immigration expiring ≤90d",
                AdverseWeight = strainImm,
                ValueLabel = immSoon.ToString(),
            },
            new WorkforceHealthDriverDto
            {
                MetricId = "onboarding_overdue",
                Label = "Onboarding tasks past due",
                AdverseWeight = strainOnb,
                ValueLabel = onboardingOverdue.ToString(),
            },
        }.OrderByDescending(d => d.AdverseWeight).Take(3).ToList();

        var openReqs = await _db.Requisitions.AsNoTracking()
            .Where(r => !r.IsDeleted && r.ClosedAt == null)
            .Select(r => new { r.CreatedAt })
            .ToListAsync(cancellationToken);
        double? avgOpenDays = openReqs.Count == 0
            ? null
            : openReqs.Average(r => (DateTime.UtcNow - r.CreatedAt).TotalDays);

        var closedReqs = await _db.Requisitions.AsNoTracking()
            .Where(r => !r.IsDeleted && r.ClosedAt != null)
            .Select(r => new { r.CreatedAt, ClosedAt = r.ClosedAt!.Value })
            .ToListAsync(cancellationToken);
        double? avgDaysToFill = closedReqs.Count == 0
            ? null
            : closedReqs.Average(r => (r.ClosedAt - r.CreatedAt).TotalDays);

        // EF Core / PostgreSQL: do not use string.Equals(..., StringComparison) inside IQueryable — not translatable.
        var pipelineCandidates = await _db.Candidates.AsNoTracking()
            .CountAsync(
                c => !c.IsDeleted
                     && c.Stage != null
                     && c.Stage.ToLower() != "hired"
                     && c.Stage.ToLower() != "rejected",
                cancellationToken);

        var payrollMonths = await BuildPayrollLastMonthsAsync(2, allowedEmployeeIds, cancellationToken);
        var movement = await BuildHeadcountMovementAsync(6, allowedEmployeeIds, cancellationToken);
        var attPulse = await BuildAttendancePulseAsync(today, active, allowedEmployeeIds, cancellationToken);

        return new ExecutiveDashboardDto
        {
            Headcount = headcount,
            WorkforceHealth = new WorkforceHealthIndexDto { Score = score, TopDrivers = driverCandidates },
            ComplianceDebt = new ComplianceDebtSummaryDto
            {
                TotalItems = immSoon + onboardingOverdue + pendingLeaveApprovals,
                ImmigrationExpiryBuckets =
                [
                    new ComplianceDebtBucketDto { BucketId = "overdue", Label = "Immigration overdue", Count = immOverdue },
                    new ComplianceDebtBucketDto { BucketId = "0_30", Label = "Expires in 0–30d", Count = imm30 },
                    new ComplianceDebtBucketDto { BucketId = "31_90", Label = "Expires in 31–90d", Count = imm31_90 },
                ],
                OverdueOnboardingTasks = onboardingOverdue,
                PendingLeaveApprovals = pendingLeaveApprovals,
            },
            TalentVelocity = new TalentVelocityDto
            {
                OpenRequisitions = openReqs.Count,
                AverageDaysOpenForOpenReqs = avgOpenDays,
                ActiveCandidatesInPipeline = pipelineCandidates,
                AverageDaysToFillClosedReqs = avgDaysToFill,
            },
            PayrollLastMonths = payrollMonths,
            HeadcountMovementTrend = movement,
            AttendancePulse = attPulse,
            DrillDown = BuildDrillDownLinks(),
        };
    }

    private static IReadOnlyList<AnalyticsDrillDownLinkDto> BuildDrillDownLinks() =>
    [
        new()
        {
            KpiId = "headcount",
            Label = "Headcount detail",
            ReportCategory = "people",
            ReportKey = "headcount-summary",
        },
        new()
        {
            KpiId = "terminations",
            Label = "Terminations & separations",
            ReportCategory = "people",
            ReportKey = "terminations",
        },
        new()
        {
            KpiId = "leave_approvals",
            Label = "Pending leave approvals",
            ReportCategory = "leave",
            ReportKey = "pending-approvals",
        },
        new()
        {
            KpiId = "immigration",
            Label = "Document / visa expiry",
            ReportCategory = "compliance",
            ReportKey = "document-expiry",
        },
        new()
        {
            KpiId = "onboarding",
            Label = "Onboarding status",
            ReportCategory = "compliance",
            ReportKey = "onboarding-status",
        },
        new()
        {
            KpiId = "recruitment",
            Label = "Open requisitions",
            ReportCategory = "recruitment",
            ReportKey = "open-requisitions",
        },
        new()
        {
            KpiId = "pipeline",
            Label = "Candidate pipeline",
            ReportCategory = "recruitment",
            ReportKey = "candidate-pipeline",
        },
        new()
        {
            KpiId = "payroll",
            Label = "Payroll register",
            ReportCategory = "payroll",
            ReportKey = "payroll-register",
        },
        new()
        {
            KpiId = "absence",
            Label = "Absent / no-punch",
            ReportCategory = "attendance",
            ReportKey = "absent-report",
        },
        new()
        {
            KpiId = "time_to_fill",
            Label = "Time-to-fill analysis",
            ReportCategory = "recruitment",
            ReportKey = "time-to-fill",
        },
    ];

    private async Task<List<PayrollMonthSummaryDto>> BuildPayrollLastMonthsAsync(
        int months,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken)
    {
        var payQuery = _db.PayStatements.AsNoTracking()
            .Where(p => !p.IsDeleted && p.Status == PayStatementStatus.Finalized);
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                payQuery = payQuery.Where(_ => false);
            else
                payQuery = payQuery.Where(p => allowedEmployeeIds.Contains(p.EmployeeId));
        }

        var keys = await payQuery
            .GroupBy(p => new { p.Year, p.Month })
            .Select(g => new { g.Key.Year, g.Key.Month })
            .OrderByDescending(x => x.Year)
            .ThenByDescending(x => x.Month)
            .Take(months)
            .ToListAsync(cancellationToken);

        var list = new List<PayrollMonthSummaryDto>();
        foreach (var k in keys.OrderBy(x => x.Year).ThenBy(x => x.Month))
        {
            var agg = await _db.Set<PayStatement>().AsNoTracking()
                .Where(p => !p.IsDeleted && p.Status == PayStatementStatus.Finalized && p.Year == k.Year && p.Month == k.Month)
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    Net = g.Sum(x => x.NetPay),
                    Gross = g.Sum(x => x.GrossPay),
                    Cnt = g.Count(),
                })
                .FirstOrDefaultAsync(cancellationToken);
            if (agg is null) continue;
            list.Add(new PayrollMonthSummaryDto
            {
                Year = k.Year,
                Month = k.Month,
                PeriodLabel = $"{new DateTime(k.Year, k.Month, 1):yyyy-MM}",
                TotalNetPay = agg.Net,
                TotalGrossPay = agg.Gross,
                StatementCount = agg.Cnt,
            });
        }

        return list;
    }

    private async Task<List<HeadcountMovementMonthDto>> BuildHeadcountMovementAsync(
        int monthCount,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken)
    {
        var start = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-(monthCount - 1));
        var list = new List<HeadcountMovementMonthDto>();
        for (var d = start; d <= new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc); d = d.AddMonths(1))
        {
            var y = d.Year;
            var m = d.Month;
            var joinerQuery = _db.Employees.AsNoTracking()
                .Where(e => e.JoinDate.Year == y && e.JoinDate.Month == m);
            var termQuery = _db.Employees.AsNoTracking()
                .Where(e => e.TerminationDate != null && e.TerminationDate.Value.Year == y && e.TerminationDate.Value.Month == m);
            if (allowedEmployeeIds != null)
            {
                if (allowedEmployeeIds.Count == 0)
                {
                    joinerQuery = joinerQuery.Where(_ => false);
                    termQuery = termQuery.Where(_ => false);
                }
                else
                {
                    joinerQuery = joinerQuery.Where(e => allowedEmployeeIds.Contains(e.Id));
                    termQuery = termQuery.Where(e => allowedEmployeeIds.Contains(e.Id));
                }
            }

            var joiners = await joinerQuery.CountAsync(cancellationToken);
            var terms = await termQuery.CountAsync(cancellationToken);
            list.Add(new HeadcountMovementMonthDto
            {
                Year = y,
                Month = m,
                PeriodLabel = $"{y}-{m:00}",
                Joiners = joiners,
                Terminations = terms,
            });
        }

        return list;
    }

    private async Task<AttendancePulseDto> BuildAttendancePulseAsync(
        DateTime todayUtc,
        int activeBaseline,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        CancellationToken cancellationToken)
    {
        var from = todayUtc.AddDays(-14);
        var absentQuery = _db.AttendanceRecords.AsNoTracking()
            .Where(a => !a.IsDeleted && a.Date >= from && a.Status != null && a.Status.ToLower() == "absent");
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                absentQuery = absentQuery.Where(_ => false);
            else
                absentQuery = absentQuery.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));
        }

        var absentDays = await absentQuery.CountAsync(cancellationToken);
        return new AttendancePulseDto
        {
            AbsentMarkedDaysLast14 = absentDays,
            ActiveEmployeesBaseline = activeBaseline,
        };
    }
}
