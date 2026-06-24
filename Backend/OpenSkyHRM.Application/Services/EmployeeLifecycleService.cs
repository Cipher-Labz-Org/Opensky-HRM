using System.Globalization;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class EmployeeLifecycleService : IEmployeeLifecycleService
{
    private static readonly string[] MilestoneTypes =
    [
        EmployeeLifecycleEventTypes.Joined,
        EmployeeLifecycleEventTypes.ProbationEnded,
        EmployeeLifecycleEventTypes.Confirmed,
        EmployeeLifecycleEventTypes.Separation,
        EmployeeLifecycleEventTypes.Reactivated,
    ];

    private static readonly string[] RoleHistoryTypes =
    [
        EmployeeLifecycleEventTypes.Promotion,
        EmployeeLifecycleEventTypes.Transfer,
        EmployeeLifecycleEventTypes.RoleChange,
        EmployeeLifecycleEventTypes.StatusChange,
        EmployeeLifecycleEventTypes.EmploymentTypeChange,
    ];

    private readonly AppDbContext _db;

    public EmployeeLifecycleService(AppDbContext db) => _db = db;

    public async Task<EmployeeLifecycleTimelineDto> GetTimelineAsync(Guid employeeId, CancellationToken cancellationToken = default)
    {
        var exists = await _db.Employees.AsNoTracking().AnyAsync(e => e.Id == employeeId && !e.IsDeleted, cancellationToken);
        if (!exists)
            return new EmployeeLifecycleTimelineDto();

        await EnsureBackfilledAsync(employeeId, cancellationToken);

        var rows = await _db.EmployeeLifecycleEvents.AsNoTracking()
            .Where(e => e.EmployeeId == employeeId && !e.IsDeleted)
            .OrderBy(e => e.EventDate)
            .ThenBy(e => e.CreatedAt)
            .ToListAsync(cancellationToken);

        var latestRoleId = rows
            .Where(e => RoleHistoryTypes.Contains(e.EventType))
            .OrderByDescending(e => e.EventDate)
            .ThenByDescending(e => e.CreatedAt)
            .Select(e => e.Id)
            .FirstOrDefault();

        var dtos = rows.Select(e => ToDto(e, e.Id == latestRoleId && latestRoleId != Guid.Empty)).ToList();

        return new EmployeeLifecycleTimelineDto
        {
            Milestones = dtos.Where(d => MilestoneTypes.Contains(d.EventType)).ToList(),
            RoleHistory = dtos.Where(d => RoleHistoryTypes.Contains(d.EventType))
                .OrderByDescending(d => d.EventDate)
                .ThenByDescending(d => d.Id)
                .ToList(),
        };
    }

    public async Task RecordJoinedAsync(Employee employee, CancellationToken cancellationToken = default)
    {
        var summary = await BuildOrgSummaryAsync(employee, cancellationToken);
        await UpsertAsync(
            employee.Id,
            ExternalKey(employee.Id, EmployeeLifecycleEventTypes.Joined, employee.JoinDate),
            EmployeeLifecycleEventTypes.Joined,
            employee.JoinDate,
            "Joined organization",
            summary,
            EmployeeLifecycleEventSources.System,
            cancellationToken);
    }

    public async Task RecordEmployeeUpdateAsync(Employee before, Employee after, CancellationToken cancellationToken = default)
    {
        var eventDate = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Unspecified);

        if (before.JoinDate != after.JoinDate)
        {
            await UpsertAsync(
                after.Id,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.Joined, after.JoinDate),
                EmployeeLifecycleEventTypes.Joined,
                after.JoinDate,
                "Joined organization",
                $"Join date updated to {FormatDate(after.JoinDate)}.",
                EmployeeLifecycleEventSources.System,
                cancellationToken);
        }

        if (before.ProbationEndDate != after.ProbationEndDate && after.ProbationEndDate.HasValue)
        {
            await UpsertAsync(
                after.Id,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.ProbationEnded, after.ProbationEndDate.Value),
                EmployeeLifecycleEventTypes.ProbationEnded,
                after.ProbationEndDate.Value,
                "Probation ended",
                null,
                EmployeeLifecycleEventSources.System,
                cancellationToken);
        }

        if (before.DateOfPermanency != after.DateOfPermanency && after.DateOfPermanency.HasValue)
        {
            await UpsertAsync(
                after.Id,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.Confirmed, after.DateOfPermanency.Value),
                EmployeeLifecycleEventTypes.Confirmed,
                after.DateOfPermanency.Value,
                "Permanent / confirmed",
                null,
                EmployeeLifecycleEventSources.System,
                cancellationToken);
        }

        if (RoleFieldsChanged(before, after))
        {
            var (title, summary) = await BuildRoleChangeTextAsync(before, after, cancellationToken);
            var type = InferRoleEventType(before, after);
            await AddAsync(
                after.Id,
                type,
                eventDate,
                title,
                summary,
                EmployeeLifecycleEventSources.System,
                ExternalKey(after.Id, type, eventDate, Guid.NewGuid()),
                cancellationToken);
        }

        if (TransferFieldsChanged(before, after))
        {
            var (title, summary) = await BuildTransferTextAsync(before, after, cancellationToken);
            await AddAsync(
                after.Id,
                EmployeeLifecycleEventTypes.Transfer,
                eventDate,
                title,
                summary,
                EmployeeLifecycleEventSources.System,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.Transfer, eventDate, Guid.NewGuid()),
                cancellationToken);
        }

        if (!string.Equals(before.Status, after.Status, StringComparison.OrdinalIgnoreCase))
        {
            await AddAsync(
                after.Id,
                EmployeeLifecycleEventTypes.StatusChange,
                eventDate,
                "Status change",
                $"{before.Status} → {after.Status}",
                EmployeeLifecycleEventSources.System,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.StatusChange, eventDate, Guid.NewGuid()),
                cancellationToken);
        }

        if (!string.Equals(before.EmploymentType, after.EmploymentType, StringComparison.Ordinal))
        {
            await AddAsync(
                after.Id,
                EmployeeLifecycleEventTypes.EmploymentTypeChange,
                eventDate,
                "Employment type change",
                $"{FormatEmploymentType(before.EmploymentType)} → {FormatEmploymentType(after.EmploymentType)}",
                EmployeeLifecycleEventSources.System,
                ExternalKey(after.Id, EmployeeLifecycleEventTypes.EmploymentTypeChange, eventDate, Guid.NewGuid()),
                cancellationToken);
        }

        if (before.TerminationDate != after.TerminationDate && after.TerminationDate.HasValue)
            await RecordSeparationAsync(after, cancellationToken);
    }

    public async Task RecordSeparationAsync(Employee employee, CancellationToken cancellationToken = default)
    {
        if (!employee.TerminationDate.HasValue) return;
        var summary = string.IsNullOrWhiteSpace(employee.TerminationReason)
            ? null
            : employee.TerminationReason.Trim();
        await UpsertAsync(
            employee.Id,
            ExternalKey(employee.Id, EmployeeLifecycleEventTypes.Separation, employee.TerminationDate.Value),
            EmployeeLifecycleEventTypes.Separation,
            employee.TerminationDate.Value,
            "Separation",
            summary,
            EmployeeLifecycleEventSources.System,
            cancellationToken);
    }

    public async Task RecordReactivatedAsync(Employee employee, CancellationToken cancellationToken = default)
    {
        var eventDate = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Unspecified);
        await AddAsync(
            employee.Id,
            EmployeeLifecycleEventTypes.Reactivated,
            eventDate,
            "Reactivated",
            "Employee returned to active status.",
            EmployeeLifecycleEventSources.System,
            ExternalKey(employee.Id, EmployeeLifecycleEventTypes.Reactivated, eventDate, Guid.NewGuid()),
            cancellationToken);
    }

    private async Task EnsureBackfilledAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var employee = await _db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted, cancellationToken);
        if (employee is null) return;

        if (!await HasEventTypeAsync(employeeId, EmployeeLifecycleEventTypes.Joined, cancellationToken))
        {
            await RecordJoinedAsync(employee, cancellationToken);

            if (employee.ProbationEndDate.HasValue)
            {
                await UpsertAsync(
                    employeeId,
                    ExternalKey(employeeId, EmployeeLifecycleEventTypes.ProbationEnded, employee.ProbationEndDate.Value),
                    EmployeeLifecycleEventTypes.ProbationEnded,
                    employee.ProbationEndDate.Value,
                    "Probation ended",
                    null,
                    EmployeeLifecycleEventSources.RecordBackfill,
                    cancellationToken);
            }

            if (employee.DateOfPermanency.HasValue)
            {
                await UpsertAsync(
                    employeeId,
                    ExternalKey(employeeId, EmployeeLifecycleEventTypes.Confirmed, employee.DateOfPermanency.Value),
                    EmployeeLifecycleEventTypes.Confirmed,
                    employee.DateOfPermanency.Value,
                    "Permanent / confirmed",
                    null,
                    EmployeeLifecycleEventSources.RecordBackfill,
                    cancellationToken);
            }

            if (employee.TerminationDate.HasValue)
                await RecordSeparationAsync(employee, cancellationToken);
        }

        if (!await _db.EmployeeLifecycleEvents.AnyAsync(
                e => e.EmployeeId == employeeId && e.Source == EmployeeLifecycleEventSources.AuditBackfill,
                cancellationToken))
        {
            await BackfillFromAuditAsync(employeeId, cancellationToken);
        }
    }

    private Task<bool> HasEventTypeAsync(Guid employeeId, string eventType, CancellationToken cancellationToken) =>
        _db.EmployeeLifecycleEvents.AnyAsync(
            e => e.EmployeeId == employeeId && !e.IsDeleted && e.EventType == eventType,
            cancellationToken);

    private async Task BackfillFromAuditAsync(Guid employeeId, CancellationToken cancellationToken)
    {
        var logs = await _db.AuditLogs.AsNoTracking()
            .Where(a => a.SubjectEmployeeId == employeeId && a.EntityName == nameof(Employee) && a.Action == "Update")
            .OrderBy(a => a.Timestamp)
            .ToListAsync(cancellationToken);

        if (logs.Count == 0) return;

        var items = logs.Select(a => new PeopleAuditLogEntryDto
        {
            Id = a.Id,
            EntityName = a.EntityName,
            EntityId = a.EntityId,
            Action = a.Action,
            SubjectEmployeeId = a.SubjectEmployeeId,
            Timestamp = a.Timestamp,
            OldValues = a.OldValues,
            NewValues = a.NewValues,
        }).ToList();

        await PeopleAuditTrailEnricher.EnrichAsync(items, _db, cancellationToken);

        foreach (var log in items)
        {
            if (log.Changes is null || log.Changes.Count == 0) continue;

            var eventDate = DateTime.SpecifyKind(log.Timestamp.Date, DateTimeKind.Unspecified);
            var key = ExternalKey(employeeId, "Audit", log.Id);

            if (await _db.EmployeeLifecycleEvents.AnyAsync(e => e.ExternalKey == key, cancellationToken))
                continue;

            var roleChanges = log.Changes.Where(c => IsRoleField(c.Field)).ToList();
            var transferChanges = log.Changes.Where(c => IsTransferField(c.Field)).ToList();
            var statusChange = log.Changes.FirstOrDefault(c => c.Field.Equals("Status", StringComparison.OrdinalIgnoreCase));
            var employmentChange = log.Changes.FirstOrDefault(c => c.Field.Equals("Employment Type", StringComparison.OrdinalIgnoreCase));

            if (roleChanges.Count > 0)
            {
                var summary = string.Join("; ", roleChanges.Select(c => $"{c.Field}: {c.Previous ?? "—"} → {c.Current ?? "—"}"));
                var title = roleChanges.Any(c => c.Field.Contains("Job Title", StringComparison.OrdinalIgnoreCase) || c.Field.Contains("Grade", StringComparison.OrdinalIgnoreCase))
                    ? "Promotion / role change"
                    : "Role change";
                await AddAsync(
                    employeeId,
                    EmployeeLifecycleEventTypes.RoleChange,
                    eventDate,
                    title,
                    summary,
                    EmployeeLifecycleEventSources.AuditBackfill,
                    key + ":role",
                    cancellationToken);
            }

            if (transferChanges.Count > 0)
            {
                var summary = string.Join("; ", transferChanges.Select(c => $"{c.Field}: {c.Previous ?? "—"} → {c.Current ?? "—"}"));
                await AddAsync(
                    employeeId,
                    EmployeeLifecycleEventTypes.Transfer,
                    eventDate,
                    "Transfer",
                    summary,
                    EmployeeLifecycleEventSources.AuditBackfill,
                    key + ":transfer",
                    cancellationToken);
            }

            if (statusChange is not null)
            {
                await AddAsync(
                    employeeId,
                    EmployeeLifecycleEventTypes.StatusChange,
                    eventDate,
                    "Status change",
                    $"{statusChange.Previous ?? "—"} → {statusChange.Current ?? "—"}",
                    EmployeeLifecycleEventSources.AuditBackfill,
                    key + ":status",
                    cancellationToken);
            }

            if (employmentChange is not null)
            {
                await AddAsync(
                    employeeId,
                    EmployeeLifecycleEventTypes.EmploymentTypeChange,
                    eventDate,
                    "Employment type change",
                    $"{employmentChange.Previous ?? "—"} → {employmentChange.Current ?? "—"}",
                    EmployeeLifecycleEventSources.AuditBackfill,
                    key + ":employment",
                    cancellationToken);
            }
        }
    }

    private async Task<string?> BuildOrgSummaryAsync(Employee employee, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (employee.JobTitleId.HasValue)
            parts.Add($"Job title: {await JobTitleNameAsync(employee.JobTitleId.Value, cancellationToken)}");
        if (employee.DepartmentId != Guid.Empty)
            parts.Add($"Department: {await DepartmentNameAsync(employee.DepartmentId, cancellationToken)}");
        if (employee.LocationId.HasValue)
            parts.Add($"Location: {await LocationNameAsync(employee.LocationId.Value, cancellationToken)}");
        return parts.Count == 0 ? null : string.Join(" · ", parts);
    }

    private async Task<(string Title, string? Summary)> BuildRoleChangeTextAsync(
        Employee before, Employee after, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (before.JobTitleId != after.JobTitleId)
        {
            var prev = before.JobTitleId.HasValue
                ? await JobTitleNameAsync(before.JobTitleId.Value, cancellationToken)
                : "—";
            var curr = after.JobTitleId.HasValue
                ? await JobTitleNameAsync(after.JobTitleId.Value, cancellationToken)
                : "—";
            parts.Add($"Job title: {prev} → {curr}");
        }
        if (before.GradeId != after.GradeId)
        {
            var prev = before.GradeId.HasValue ? await GradeNameAsync(before.GradeId.Value, cancellationToken) : "—";
            var curr = after.GradeId.HasValue ? await GradeNameAsync(after.GradeId.Value, cancellationToken) : "—";
            parts.Add($"Grade: {prev} → {curr}");
        }
        if (before.PositionId != after.PositionId)
        {
            var prev = before.PositionId.HasValue ? await PositionTitleAsync(before.PositionId.Value, cancellationToken) : "—";
            var curr = after.PositionId.HasValue ? await PositionTitleAsync(after.PositionId.Value, cancellationToken) : "—";
            parts.Add($"Position: {prev} → {curr}");
        }

        var summary = parts.Count == 0 ? null : string.Join(" · ", parts);
        var title = InferRoleEventType(before, after) == EmployeeLifecycleEventTypes.Promotion
            ? "Promotion"
            : "Role change";
        return (title, summary);
    }

    private async Task<(string Title, string? Summary)> BuildTransferTextAsync(
        Employee before, Employee after, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        if (before.DepartmentId != after.DepartmentId)
        {
            var prev = await DepartmentNameAsync(before.DepartmentId, cancellationToken);
            var curr = await DepartmentNameAsync(after.DepartmentId, cancellationToken);
            parts.Add($"Department: {prev} → {curr}");
        }
        if (before.LocationId != after.LocationId)
        {
            var prev = before.LocationId.HasValue ? await LocationNameAsync(before.LocationId.Value, cancellationToken) : "—";
            var curr = after.LocationId.HasValue ? await LocationNameAsync(after.LocationId.Value, cancellationToken) : "—";
            parts.Add($"Location: {prev} → {curr}");
        }
        if (before.BusinessUnitId != after.BusinessUnitId)
        {
            var prev = before.BusinessUnitId.HasValue ? await BusinessUnitNameAsync(before.BusinessUnitId.Value, cancellationToken) : "—";
            var curr = after.BusinessUnitId.HasValue ? await BusinessUnitNameAsync(after.BusinessUnitId.Value, cancellationToken) : "—";
            parts.Add($"Business unit: {prev} → {curr}");
        }
        if (before.ManagerId != after.ManagerId)
        {
            var prev = before.ManagerId.HasValue ? await EmployeeLabelAsync(before.ManagerId.Value, cancellationToken) : "—";
            var curr = after.ManagerId.HasValue ? await EmployeeLabelAsync(after.ManagerId.Value, cancellationToken) : "—";
            parts.Add($"Manager: {prev} → {curr}");
        }

        return ("Transfer", parts.Count == 0 ? null : string.Join(" · ", parts));
    }

    private static string InferRoleEventType(Employee before, Employee after)
    {
        if (before.JobTitleId != after.JobTitleId || before.GradeId != after.GradeId)
            return EmployeeLifecycleEventTypes.Promotion;
        return EmployeeLifecycleEventTypes.RoleChange;
    }

    private static bool RoleFieldsChanged(Employee before, Employee after) =>
        before.JobTitleId != after.JobTitleId
        || before.GradeId != after.GradeId
        || before.PositionId != after.PositionId;

    private static bool TransferFieldsChanged(Employee before, Employee after) =>
        before.DepartmentId != after.DepartmentId
        || before.LocationId != after.LocationId
        || before.BusinessUnitId != after.BusinessUnitId
        || before.ManagerId != after.ManagerId;

    private static bool IsRoleField(string field) =>
        field.Contains("Job Title", StringComparison.OrdinalIgnoreCase)
        || field.Contains("Grade", StringComparison.OrdinalIgnoreCase)
        || field.Contains("Position", StringComparison.OrdinalIgnoreCase);

    private static bool IsTransferField(string field) =>
        field.Contains("Department", StringComparison.OrdinalIgnoreCase)
        || field.Contains("Location", StringComparison.OrdinalIgnoreCase)
        || field.Contains("Business Unit", StringComparison.OrdinalIgnoreCase)
        || field.Contains("Manager", StringComparison.OrdinalIgnoreCase);

    private async Task UpsertAsync(
        Guid employeeId,
        string externalKey,
        string eventType,
        DateTime eventDate,
        string title,
        string? summary,
        string source,
        CancellationToken cancellationToken)
    {
        var existing = await _db.EmployeeLifecycleEvents
            .FirstOrDefaultAsync(e => e.ExternalKey == externalKey, cancellationToken);
        if (existing is not null)
        {
            existing.EventDate = DateOnlyDate(eventDate);
            existing.Title = title;
            existing.Summary = summary;
            await _db.SaveChangesAsync(cancellationToken);
            return;
        }

        await AddAsync(employeeId, eventType, eventDate, title, summary, source, externalKey, cancellationToken);
    }

    private async Task AddAsync(
        Guid employeeId,
        string eventType,
        DateTime eventDate,
        string title,
        string? summary,
        string source,
        string externalKey,
        CancellationToken cancellationToken)
    {
        if (await _db.EmployeeLifecycleEvents.AnyAsync(e => e.ExternalKey == externalKey, cancellationToken))
            return;

        _db.EmployeeLifecycleEvents.Add(new EmployeeLifecycleEvent
        {
            EmployeeId = employeeId,
            EventType = eventType,
            EventDate = DateOnlyDate(eventDate),
            Title = title,
            Summary = summary,
            Source = source,
            ExternalKey = externalKey,
        });
        await _db.SaveChangesAsync(cancellationToken);
    }

    private static DateTime DateOnlyDate(DateTime dt) =>
        DateTime.SpecifyKind(dt.Date, DateTimeKind.Unspecified);

    private static string ExternalKey(Guid employeeId, string kind, DateTime date) =>
        $"{employeeId:N}:{kind}:{date:yyyy-MM-dd}";

    private static string ExternalKey(Guid employeeId, string kind, DateTime date, Guid unique) =>
        $"{employeeId:N}:{kind}:{date:yyyy-MM-dd}:{unique:N}";

    private static string ExternalKey(Guid employeeId, string kind, Guid id) =>
        $"{employeeId:N}:{kind}:{id:N}";

    private static EmployeeLifecycleEventDto ToDto(EmployeeLifecycleEvent e, bool isCurrentRole) =>
        new()
        {
            Id = e.Id,
            EventType = e.EventType,
            EventTypeLabel = EmployeeLifecycleEventTypes.Label(e.EventType),
            EventDate = e.EventDate,
            Title = e.Title,
            Summary = e.Summary,
            IsCurrentRole = isCurrentRole,
        };

    private static string FormatDate(DateTime dt) =>
        dt.ToString("MMM d, yyyy", CultureInfo.InvariantCulture);

    private static string FormatEmploymentType(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "—" : value.Replace("FullTime", "Full-time ").Replace("PartTime", "Part-time ").Trim();

    private async Task<string> JobTitleNameAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.JobTitles.AsNoTracking().Where(j => j.Id == id).Select(j => j.Title).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> DepartmentNameAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.Departments.AsNoTracking().Where(d => d.Id == id).Select(d => d.Name).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> LocationNameAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.Locations.AsNoTracking().Where(l => l.Id == id).Select(l => l.Name).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> GradeNameAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.Grades.AsNoTracking().Where(g => g.Id == id).Select(g => g.Name).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> PositionTitleAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.Positions.AsNoTracking().Where(p => p.Id == id).Select(p => p.Title).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> BusinessUnitNameAsync(Guid id, CancellationToken cancellationToken) =>
        await _db.BusinessUnits.AsNoTracking().Where(b => b.Id == id).Select(b => b.Name).FirstOrDefaultAsync(cancellationToken) ?? "—";

    private async Task<string> EmployeeLabelAsync(Guid id, CancellationToken cancellationToken)
    {
        var e = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return e is null ? "—" : $"{e.FirstName} {e.LastName}".Trim();
    }
}
