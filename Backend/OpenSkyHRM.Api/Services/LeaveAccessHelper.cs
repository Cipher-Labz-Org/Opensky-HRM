using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves Leave module scope (Own, Team, All) from JWT permissions, intersected with People dimension assignments.
/// </summary>
public static class LeaveAccessHelper
{
    /// <summary>
    /// Returns employee IDs the user can access for Leave (Own = self, Team = self + direct reports, All = null).
    /// Team uses EmployeeSupervisors (employees who have this user as supervisor).
    /// When excludeSelfForApprovalList is true and scope is Team, returns only direct reports (excludes self)
    /// so supervisors do not see their own leave in the approval list.
    /// Dimension restrictions from User Management always apply — ADMIN / Leave:All cannot bypass them.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(ClaimsPrincipal user, AppDbContext db, string action = "Read", bool excludeSelfForApprovalList = false)
    {
        var leaveRbacIds = await ResolveLeaveRbacScopeIdsAsync(user, db, action, excludeSelfForApprovalList);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
        return PeopleAccessHelper.IntersectEmployeeScopes(leaveRbacIds, dimensionIds);
    }

    /// <summary>
    /// Resolves Leave RBAC scope only (no dimension filtering). Returns null for unrestricted Leave scope (All / ADMIN).
    /// </summary>
    private static async Task<IReadOnlyList<Guid>?> ResolveLeaveRbacScopeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action,
        bool excludeSelfForApprovalList)
    {
        if (UserHasRole(user, "ADMIN"))
            return null;

        var scope = ResolveScope(user, action);
        if (scope == "All")
            return null;

        var currentId = GetCurrentEmployeeId(user);
        if (!currentId.HasValue)
            return Array.Empty<Guid>();

        if (scope == "Own")
            return new[] { currentId.Value };

        if (scope == "Team")
        {
            var teamIds = await db.EmployeeSupervisors
                .Where(es => es.SupervisorId == currentId.Value)
                .Select(es => es.EmployeeId)
                .ToListAsync();
            if (excludeSelfForApprovalList)
                return teamIds;
            return teamIds.Union(new[] { currentId.Value }).ToList();
        }

        return Array.Empty<Guid>();
    }

    /// <summary>Read carry-forward month / narrative (Apply Leave, balances, Policies view). Not limited to supervisors.</summary>
    public static bool CanReadCarryForwardAvailabilitySettings(ClaimsPrincipal user)
    {
        if (UserHasRole(user, "ADMIN") || UserHasRole(user, "HR_MANAGER") || UserHasRole(user, "SUPERVISOR"))
            return true;
        return ResolveScope(user, "Read") != "None";
    }

    /// <summary>
    /// Update carry-forward system settings: same privilege as editing leave policies
    /// (<see cref="ResolveScope"/> Update = All), plus users with the <b>Supervisor</b> role (team policy reference).
    /// </summary>
    public static bool CanUpdateCarryForwardAvailabilitySettings(ClaimsPrincipal user)
    {
        if (ResolveScope(user, "Update") == "All")
            return true;
        return UserHasRole(user, "SUPERVISOR");
    }

    private static bool UserHasRole(ClaimsPrincipal user, string roleCode)
    {
        if (user.IsInRole(roleCode)) return true;
        foreach (var c in user.FindAll(ClaimTypes.Role))
            if (string.Equals(c.Value, roleCode, StringComparison.OrdinalIgnoreCase)) return true;
        foreach (var c in user.FindAll("role"))
            if (string.Equals(c.Value, roleCode, StringComparison.OrdinalIgnoreCase)) return true;
        if (string.Equals(roleCode, "ADMIN", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var c in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
                if (string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase)) return true;
        }
        if (string.Equals(roleCode, "SUPERVISOR", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var c in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
                if (string.Equals(c.Value, "Supervisor", StringComparison.OrdinalIgnoreCase)) return true;
        }

        return false;
    }

    public static string ResolveScope(ClaimsPrincipal user, string action = "Read")
    {
        if (UserHasRole(user, "ADMIN"))
            return "All";

        var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
        var leavePerms = permissions
            .Where(p => p.StartsWith("Leave:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (leavePerms.Any(p => p.Contains($":{action}:All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (leavePerms.Any(p => p.Contains($":{action}:Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (leavePerms.Any(p => p.Contains($":{action}:Own", StringComparison.OrdinalIgnoreCase)))
            return "Own";

        return "None";
    }

    public static Guid? GetCurrentEmployeeId(ClaimsPrincipal user)
    {
        var employeeIdStr = user.FindFirstValue("employeeId");
        if (string.IsNullOrEmpty(employeeIdStr) || !Guid.TryParse(employeeIdStr, out var id))
            return null;
        return id;
    }

    public static async Task<bool> CanAccessEmployeeLeaveAsync(ClaimsPrincipal user, AppDbContext db, Guid employeeId, string action = "Read")
    {
        var allowedIds = await GetAllowedEmployeeIdsAsync(user, db, action);
        if (allowedIds == null)
            return true;
        return allowedIds.Contains(employeeId);
    }

    /// <summary>
    /// Returns the direct supervisor's employee ID for the given employee (from EmployeeSupervisors, ReportingMethod=Direct).
    /// Returns null if the employee has no direct supervisor.
    /// </summary>
    public static async Task<Guid?> GetDirectSupervisorIdAsync(AppDbContext db, Guid employeeId)
    {
        var id = await db.EmployeeSupervisors
            .Where(es => !es.IsDeleted && es.EmployeeId == employeeId && es.ReportingMethod == "Direct")
            .Select(es => es.SupervisorId)
            .FirstOrDefaultAsync();
        return id == default ? null : id;
    }

    /// <summary>
    /// Returns true if potentialSupervisorId is a direct supervisor of employeeId.
    /// </summary>
    public static async Task<bool> IsSupervisorOfAsync(AppDbContext db, Guid employeeId, Guid potentialSupervisorId)
    {
        return await db.EmployeeSupervisors
            .AnyAsync(es => !es.IsDeleted && es.EmployeeId == employeeId && es.SupervisorId == potentialSupervisorId && es.ReportingMethod == "Direct");
    }

}
