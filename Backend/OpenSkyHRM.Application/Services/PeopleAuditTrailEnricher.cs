using System.Globalization;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Resolves FK GUIDs in stored audit JSON and builds readable before/after rows for the People Hub trail.
/// </summary>
public static class PeopleAuditTrailEnricher
{
    private static readonly Regex InsertSpaceBeforeCaps = new("(\\B[A-Z])", RegexOptions.Compiled);

    public static async Task EnrichAsync(IList<PeopleAuditLogEntryDto> items, AppDbContext db, CancellationToken cancellationToken = default)
    {
        if (items.Count == 0) return;

        var buckets = new Dictionary<string, HashSet<Guid>>(StringComparer.OrdinalIgnoreCase);
        foreach (var item in items)
        {
            CollectGuids(item.OldValues, buckets);
            CollectGuids(item.NewValues, buckets);
        }

        var lookups = await BuildLookupsAsync(db, buckets, cancellationToken);

        var subjectIds = items.Where(i => i.SubjectEmployeeId.HasValue).Select(i => i.SubjectEmployeeId!.Value).Distinct().ToList();
        Dictionary<Guid, string> empLabels = new();
        if (subjectIds.Count > 0)
        {
            empLabels = await db.Employees.AsNoTracking()
                .Where(e => subjectIds.Contains(e.Id))
                .ToDictionaryAsync(
                    e => e.Id,
                    e => $"{e.EmployeeCode} · {e.FirstName} {e.LastName}".Trim(),
                    cancellationToken);
        }

        foreach (var item in items)
        {
            if (item.SubjectEmployeeId.HasValue && empLabels.TryGetValue(item.SubjectEmployeeId.Value, out var label))
                item.SubjectEmployeeLabel = label;

            item.Changes = BuildChangeRows(item.EntityName, item.Action, item.OldValues, item.NewValues, lookups);
        }
    }

    private static void CollectGuids(string? json, IDictionary<string, HashSet<Guid>> buckets)
    {
        var obj = ParseJsonObject(json);
        if (obj is null) return;

        foreach (var (key, node) in obj)
        {
            if (!TryGetGuid(node, out var g)) continue;
            if (!IsKnownFkProperty(key)) continue;
            if (!buckets.ContainsKey(key))
                buckets[key] = new HashSet<Guid>();
            buckets[key].Add(g);
        }
    }

    private static bool IsKnownFkProperty(string key) =>
        string.Equals(key, nameof(Employee.DepartmentId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.BusinessUnitId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.PositionId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.LocationId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.GradeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.JobTitleId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.ManagerId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Employee.ShiftPatternId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmployeeSupervisor.EmployeeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmployeeSupervisor.SupervisorId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmergencyContact.EmployeeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Dependent.EmployeeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(Education.EmployeeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmployeeCompensation.EmployeeId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmployeeCompensation.ComponentId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, nameof(EmployeeCompensation.BatchId), StringComparison.OrdinalIgnoreCase)
        || string.Equals(key, "EmployeeId", StringComparison.OrdinalIgnoreCase);

    private static async Task<Dictionary<string, Dictionary<Guid, string>>> BuildLookupsAsync(
        AppDbContext db,
        Dictionary<string, HashSet<Guid>> buckets,
        CancellationToken cancellationToken)
    {
        var lookups = new Dictionary<string, Dictionary<Guid, string>>(StringComparer.OrdinalIgnoreCase);

        async Task LoadAsync(string prop, Func<Task<Dictionary<Guid, string>>> loader)
        {
            if (!buckets.TryGetValue(prop, out var ids) || ids.Count == 0) return;
            lookups[prop] = await loader();
        }

        await LoadAsync(nameof(Employee.DepartmentId), async () =>
            await db.Departments.AsNoTracking().Where(d => buckets[nameof(Employee.DepartmentId)].Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => d.Name, cancellationToken));

        await LoadAsync(nameof(Employee.BusinessUnitId), async () =>
            await db.BusinessUnits.AsNoTracking().Where(b => buckets[nameof(Employee.BusinessUnitId)].Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, b => b.Name, cancellationToken));

        await LoadAsync(nameof(Employee.PositionId), async () =>
            await db.Positions.AsNoTracking().Where(p => buckets[nameof(Employee.PositionId)].Contains(p.Id))
                .ToDictionaryAsync(p => p.Id, p => string.IsNullOrEmpty(p.Code) ? p.Title : $"{p.Title} ({p.Code})", cancellationToken));

        await LoadAsync(nameof(Employee.LocationId), async () =>
            await db.Locations.AsNoTracking().Where(l => buckets[nameof(Employee.LocationId)].Contains(l.Id))
                .ToDictionaryAsync(l => l.Id, l => l.Name, cancellationToken));

        await LoadAsync(nameof(Employee.GradeId), async () =>
            await db.Grades.AsNoTracking().Where(g => buckets[nameof(Employee.GradeId)].Contains(g.Id))
                .ToDictionaryAsync(g => g.Id, g => g.Name, cancellationToken));

        await LoadAsync(nameof(Employee.JobTitleId), async () =>
            await db.JobTitles.AsNoTracking().Where(j => buckets[nameof(Employee.JobTitleId)].Contains(j.Id))
                .ToDictionaryAsync(j => j.Id, j => string.IsNullOrEmpty(j.Code) ? j.Title : $"{j.Title} ({j.Code})", cancellationToken));

        await LoadAsync(nameof(Employee.ShiftPatternId), async () =>
            await db.ShiftPatterns.AsNoTracking().Where(s => buckets[nameof(Employee.ShiftPatternId)].Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => string.IsNullOrEmpty(s.Code) ? s.Name : $"{s.Name} ({s.Code})", cancellationToken));

        await LoadAsync(nameof(EmployeeCompensation.ComponentId), async () =>
            await db.CompensationComponents.AsNoTracking()
                .Where(c => buckets[nameof(EmployeeCompensation.ComponentId)].Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => string.IsNullOrEmpty(c.Code) ? c.Name : $"{c.Name} ({c.Code})", cancellationToken));

        // Employee-scoped IDs share the same display map
        var employeeIdBuckets = new HashSet<Guid>();
        foreach (var key in new[]
                 {
                     nameof(Employee.ManagerId),
                     nameof(EmployeeSupervisor.EmployeeId),
                     nameof(EmployeeSupervisor.SupervisorId),
                     nameof(EmergencyContact.EmployeeId),
                     nameof(Dependent.EmployeeId),
                     nameof(Education.EmployeeId),
                     nameof(EmployeeCompensation.EmployeeId),
                     "EmployeeId",
                 })
        {
            if (buckets.TryGetValue(key, out var set))
                employeeIdBuckets.UnionWith(set);
        }

        Dictionary<Guid, string>? employeeMap = null;
        if (employeeIdBuckets.Count > 0)
        {
            employeeMap = await db.Employees.AsNoTracking()
                .Where(e => employeeIdBuckets.Contains(e.Id))
                .ToDictionaryAsync(e => e.Id, e => $"{e.EmployeeCode} · {e.FirstName} {e.LastName}".Trim(), cancellationToken);
        }

        void AssignEmployeeScoped(string prop)
        {
            if (employeeMap is null || !buckets.ContainsKey(prop)) return;
            lookups[prop] = employeeMap;
        }

        AssignEmployeeScoped(nameof(Employee.ManagerId));
        AssignEmployeeScoped(nameof(EmployeeSupervisor.EmployeeId));
        AssignEmployeeScoped(nameof(EmployeeSupervisor.SupervisorId));
        AssignEmployeeScoped(nameof(EmergencyContact.EmployeeId));
        AssignEmployeeScoped(nameof(Dependent.EmployeeId));
        AssignEmployeeScoped(nameof(Education.EmployeeId));
        AssignEmployeeScoped(nameof(EmployeeCompensation.EmployeeId));
        AssignEmployeeScoped("EmployeeId");

        if (buckets.TryGetValue(nameof(EmployeeCompensation.BatchId), out var batchIds) && batchIds.Count > 0)
        {
            lookups[nameof(EmployeeCompensation.BatchId)] = await db.PayrollBatches.AsNoTracking()
                .Where(b => batchIds.Contains(b.Id))
                .ToDictionaryAsync(b => b.Id, b => $"{b.BatchCode} ({b.Year:0000}-{b.Month:00})", cancellationToken);
        }

        return lookups;
    }

    private static List<PeopleAuditChangeRowDto> BuildChangeRows(
        string entityName,
        string action,
        string? oldJson,
        string? newJson,
        Dictionary<string, Dictionary<Guid, string>> lookups)
    {
        var oldO = ParseJsonObject(oldJson);
        var newO = ParseJsonObject(newJson);
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (oldO is not null)
            foreach (var k in oldO.Keys) keys.Add(k);
        if (newO is not null)
            foreach (var k in newO.Keys) keys.Add(k);

        var rows = new List<PeopleAuditChangeRowDto>();
        foreach (var key in keys.OrderBy(k => FriendlyFieldName(k), StringComparer.OrdinalIgnoreCase))
        {
            JsonNode? oldN = null;
            JsonNode? newN = null;
            oldO?.TryGetValue(key, out oldN);
            newO?.TryGetValue(key, out newN);
            var prev = FormatValue(entityName, key, oldN, lookups);
            var curr = FormatValue(entityName, key, newN, lookups);
            if (action.Equals("Update", StringComparison.OrdinalIgnoreCase) && prev == curr)
                continue;

            rows.Add(new PeopleAuditChangeRowDto
            {
                Field = FriendlyFieldName(key),
                Previous = prev,
                Current = curr,
            });
        }

        return rows;
    }

    private static Dictionary<string, JsonNode?>? ParseJsonObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var node = JsonNode.Parse(json) as JsonObject;
            if (node is null) return null;
            return node.ToDictionary(p => p.Key, p => p.Value, StringComparer.OrdinalIgnoreCase);
        }
        catch
        {
            return null;
        }
    }

    private static bool TryGetGuid(JsonNode? node, out Guid g)
    {
        g = default;
        if (node is null) return false;
        if (node is JsonValue jv)
        {
            if (jv.TryGetValue<Guid>(out g)) return true;
            if (jv.TryGetValue<string>(out var s) && Guid.TryParse(s, out g)) return true;
        }

        return false;
    }

    private static string FormatValue(
        string entityName,
        string propName,
        JsonNode? node,
        Dictionary<string, Dictionary<Guid, string>> lookups)
    {
        if (node is null) return "—";

        if (TryGetGuid(node, out var g))
        {
            if (lookups.TryGetValue(propName, out var map) && map.TryGetValue(g, out var label))
                return label;
            return g.ToString();
        }

        if (node is JsonValue jv)
        {
            if (jv.TryGetValue<bool>(out var b)) return b ? "Yes" : "No";

            if (jv.TryGetValue<decimal>(out var dec)) return dec.ToString(CultureInfo.InvariantCulture);

            if (jv.TryGetValue<double>(out var dbl)) return dbl.ToString(CultureInfo.InvariantCulture);

            if (jv.TryGetValue<int>(out var i))
            {
                if (string.Equals(propName, nameof(SalaryRevision.Status), StringComparison.OrdinalIgnoreCase)
                    && string.Equals(entityName, nameof(SalaryRevision), StringComparison.OrdinalIgnoreCase)
                    && Enum.IsDefined(typeof(ApprovalStatus), i))
                    return ((ApprovalStatus)i).ToString();

                if (string.Equals(propName, nameof(Employee.Gender), StringComparison.OrdinalIgnoreCase)
                    && string.Equals(entityName, nameof(Employee), StringComparison.OrdinalIgnoreCase)
                    && Enum.IsDefined(typeof(Gender), i))
                    return ((Gender)i).ToString();
            }

            if (jv.TryGetValue<DateTime>(out var dt))
            {
                if (dt.Kind == DateTimeKind.Unspecified)
                    return dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) + " (office)";
                if (dt.Kind == DateTimeKind.Utc)
                    return dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture) + " UTC";
                return dt.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
            }
        }

        var raw = node.ToString();
        if (string.IsNullOrWhiteSpace(raw)) return "—";
        return raw.Trim().Trim('"');
    }

    private static string FriendlyFieldName(string propertyName)
    {
        var spaced = InsertSpaceBeforeCaps.Replace(propertyName, " $1").Trim();
        if (spaced.EndsWith(" Id", StringComparison.Ordinal))
            spaced = spaced[..^3].Trim();
        return spaced;
    }
}
