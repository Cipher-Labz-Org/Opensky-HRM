using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Reporting lines for overtime visibility and approval.
/// Includes every <see cref="EmployeeSupervisor"/> method (Direct, Indirect, Both)
/// plus <see cref="Employee.ManagerId"/>, so skip-level managers can see the tree.
/// </summary>
public sealed class ReportingGraph
{
    public Dictionary<Guid, Guid> PrimarySupervisorByEmployee { get; } = new();
    public Dictionary<Guid, HashSet<Guid>> ParentsByEmployee { get; } = new();
    public Dictionary<Guid, HashSet<Guid>> ChildrenBySupervisor { get; } = new();
}

public static class ReportingChain
{
    public static async Task<ReportingGraph> LoadAsync(
        AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        var graph = new ReportingGraph();

        var links = await db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Where(s => !s.IsDeleted && s.EmployeeId != s.SupervisorId)
            .Select(s => new { s.EmployeeId, s.SupervisorId, s.ReportingMethod, s.CreatedAt })
            .ToListAsync(cancellationToken);

        foreach (var link in links)
            AddEdge(graph, link.EmployeeId, link.SupervisorId);

        var managers = await db.Employees
            .AsNoTracking()
            .Where(e => e.ManagerId != null && e.ManagerId != e.Id)
            .Select(e => new { e.Id, ManagerId = e.ManagerId!.Value })
            .ToListAsync(cancellationToken);

        foreach (var row in managers)
            AddEdge(graph, row.Id, row.ManagerId);

        foreach (var group in links.GroupBy(x => x.EmployeeId))
        {
            var preferred = group
                .OrderByDescending(x => IsDirectMethod(x.ReportingMethod))
                .ThenByDescending(x => string.Equals(x.ReportingMethod, "Both", StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(x => x.CreatedAt)
                .First();
            graph.PrimarySupervisorByEmployee[group.Key] = preferred.SupervisorId;
        }

        foreach (var row in managers)
        {
            if (!graph.PrimarySupervisorByEmployee.ContainsKey(row.Id))
                graph.PrimarySupervisorByEmployee[row.Id] = row.ManagerId;
        }

        return graph;
    }

    /// <summary>Backward-compatible one-parent map (primary supervisor only).</summary>
    public static async Task<Dictionary<Guid, Guid>> LoadSupervisorByEmployeeAsync(
        AppDbContext db,
        CancellationToken cancellationToken = default)
    {
        var graph = await LoadAsync(db, cancellationToken);
        return graph.PrimarySupervisorByEmployee;
    }

    public static bool IsInSupervisorChain(ReportingGraph graph, Guid employeeId, Guid potentialSupervisorId)
        => IsInSupervisorChain(graph.ParentsByEmployee, employeeId, potentialSupervisorId);

    public static bool IsInSupervisorChain(
        IReadOnlyDictionary<Guid, Guid> supervisorByEmployee,
        Guid employeeId,
        Guid potentialSupervisorId)
        => IsInSupervisorChain(AsParentSets(supervisorByEmployee), employeeId, potentialSupervisorId);

    public static HashSet<Guid> GetDescendantIds(ReportingGraph graph, Guid supervisorId)
        => GetDescendantIds(graph.ChildrenBySupervisor, supervisorId);

    public static HashSet<Guid> GetDescendantIds(
        IReadOnlyDictionary<Guid, Guid> supervisorByEmployee,
        Guid supervisorId)
    {
        var children = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var pair in supervisorByEmployee)
        {
            if (pair.Key == pair.Value)
                continue;
            if (!children.TryGetValue(pair.Value, out var set))
            {
                set = [];
                children[pair.Value] = set;
            }
            set.Add(pair.Key);
        }

        return GetDescendantIds(children, supervisorId);
    }

    private static bool IsInSupervisorChain(
        IReadOnlyDictionary<Guid, HashSet<Guid>> parentsByEmployee,
        Guid employeeId,
        Guid potentialSupervisorId)
    {
        if (employeeId == potentialSupervisorId)
            return false;

        var seen = new HashSet<Guid> { employeeId };
        var queue = new Queue<Guid>();
        queue.Enqueue(employeeId);
        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!parentsByEmployee.TryGetValue(current, out var parents))
                continue;
            foreach (var parent in parents)
            {
                if (parent == potentialSupervisorId)
                    return true;
                if (seen.Add(parent))
                    queue.Enqueue(parent);
            }
        }

        return false;
    }

    private static HashSet<Guid> GetDescendantIds(
        IReadOnlyDictionary<Guid, HashSet<Guid>> childrenBySupervisor,
        Guid supervisorId)
    {
        var result = new HashSet<Guid>();
        var stack = new Stack<Guid>();
        stack.Push(supervisorId);
        while (stack.Count > 0)
        {
            var current = stack.Pop();
            if (!childrenBySupervisor.TryGetValue(current, out var kids))
                continue;
            foreach (var child in kids)
            {
                if (result.Add(child))
                    stack.Push(child);
            }
        }

        return result;
    }

    private static void AddEdge(ReportingGraph graph, Guid employeeId, Guid supervisorId)
    {
        if (employeeId == supervisorId)
            return;

        if (!graph.ParentsByEmployee.TryGetValue(employeeId, out var parents))
        {
            parents = [];
            graph.ParentsByEmployee[employeeId] = parents;
        }
        parents.Add(supervisorId);

        if (!graph.ChildrenBySupervisor.TryGetValue(supervisorId, out var children))
        {
            children = [];
            graph.ChildrenBySupervisor[supervisorId] = children;
        }
        children.Add(employeeId);
    }

    private static Dictionary<Guid, HashSet<Guid>> AsParentSets(IReadOnlyDictionary<Guid, Guid> supervisorByEmployee)
    {
        var parents = new Dictionary<Guid, HashSet<Guid>>();
        foreach (var pair in supervisorByEmployee)
        {
            if (pair.Key == pair.Value)
                continue;
            parents[pair.Key] = [pair.Value];
        }
        return parents;
    }

    public static bool IsDirectMethod(string? method)
        => string.Equals(method, "Direct", StringComparison.OrdinalIgnoreCase)
           || string.Equals(method, "Both", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Employees whose direct supervisor is <paramref name="supervisorId"/>.
    /// Direct means a Direct/Both reporting line, or <see cref="Employee.ManagerId"/> when no direct line exists.
    /// Skip-level and Indirect-only links are not included.
    /// </summary>
    public static async Task<HashSet<Guid>> GetDirectReportIdsAsync(
        AppDbContext db,
        Guid supervisorId,
        CancellationToken cancellationToken = default)
    {
        var linkedIds = await db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Where(s => !s.IsDeleted && s.SupervisorId == supervisorId && s.EmployeeId != supervisorId)
            .Select(s => s.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var managerIds = await db.Employees
            .AsNoTracking()
            .Where(e => !e.IsDeleted && e.ManagerId == supervisorId && e.Id != supervisorId)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        var candidateIds = linkedIds.Concat(managerIds).Distinct().ToList();
        if (candidateIds.Count == 0)
            return [];

        var links = await db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Where(s => !s.IsDeleted && candidateIds.Contains(s.EmployeeId) && s.EmployeeId != s.SupervisorId)
            .Select(s => new SupervisorLinkRow(s.EmployeeId, s.SupervisorId, s.ReportingMethod, s.CreatedAt))
            .ToListAsync(cancellationToken);

        var managers = await db.Employees
            .AsNoTracking()
            .Where(e => candidateIds.Contains(e.Id) && !e.IsDeleted && e.ManagerId != null && e.ManagerId != e.Id)
            .Select(e => new { e.Id, ManagerId = e.ManagerId!.Value })
            .ToListAsync(cancellationToken);

        var map = ResolveDirectSupervisorByEmployee(
            links,
            managers.Select(m => new KeyValuePair<Guid, Guid>(m.Id, m.ManagerId)));
        return DirectReportIds(map, supervisorId);
    }

    /// <summary>
    /// One direct supervisor per employee. Direct beats Both, then the newest link.
    /// <paramref name="managerByEmployee"/> is used only when the employee has no Direct/Both line.
    /// </summary>
    public static Dictionary<Guid, Guid> ResolveDirectSupervisorByEmployee(
        IEnumerable<SupervisorLinkRow> links,
        IEnumerable<KeyValuePair<Guid, Guid>> managerByEmployee)
    {
        var map = new Dictionary<Guid, Guid>();
        foreach (var group in links.Where(l => l.EmployeeId != l.SupervisorId).GroupBy(l => l.EmployeeId))
        {
            var preferred = group
                .Where(x => IsDirectMethod(x.ReportingMethod))
                .OrderByDescending(x => string.Equals(x.ReportingMethod, "Direct", StringComparison.OrdinalIgnoreCase))
                .ThenByDescending(x => x.CreatedAt)
                .FirstOrDefault();
            if (preferred != null)
                map[group.Key] = preferred.SupervisorId;
        }

        foreach (var pair in managerByEmployee)
        {
            if (pair.Key == pair.Value || map.ContainsKey(pair.Key))
                continue;
            map[pair.Key] = pair.Value;
        }

        return map;
    }

    public static HashSet<Guid> DirectReportIds(
        IReadOnlyDictionary<Guid, Guid> directSupervisorByEmployee,
        Guid supervisorId)
    {
        var result = new HashSet<Guid>();
        foreach (var pair in directSupervisorByEmployee)
        {
            if (pair.Value == supervisorId && pair.Key != supervisorId)
                result.Add(pair.Key);
        }

        return result;
    }
}

/// <summary>One employee-to-supervisor reporting line used to resolve the direct supervisor.</summary>
public sealed record SupervisorLinkRow(Guid EmployeeId, Guid SupervisorId, string? ReportingMethod, DateTime CreatedAt);
