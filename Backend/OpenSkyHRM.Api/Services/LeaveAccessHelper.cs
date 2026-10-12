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
    /// Leave RBAC (Own / Team / All). Team uses the same reporting tree as People Hub.
    /// Dimension restrictions from User Management always apply.
    /// </summary>
    /// <summary>
    /// Broadest read scope for leave request lists: max of Leave and Approvals module permissions.
    /// </summary>
    public static string ResolveLeaveRequestsReadScope(ClaimsPrincipal user) =>
        RbacScopeHelper.MaxScope(ResolveScope(user, "Read"), ApprovalsAccessHelper.ResolveScope(user, "Read"));

    public static async Task<IReadOnlyList<Guid>?> GetLeaveRequestsAllowedEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        bool excludeSelfForApprovalList = false)
    {
        var effectiveScope = ResolveLeaveRequestsReadScope(user);
        var leaveRbacIds = await ResolveEmployeeIdsForScopeAsync(user, db, effectiveScope, excludeSelfForApprovalList);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
        var allowed = PeopleAccessHelper.IntersectEmployeeScopes(leaveRbacIds, dimensionIds);

        if (string.Equals(effectiveScope, "Own", StringComparison.OrdinalIgnoreCase))
        {
            var ownId = await GetCurrentEmployeeIdAsync(user, db);
            if (ownId.HasValue && allowed != null && !allowed.Contains(ownId.Value))
            {
                var withOwn = allowed.ToList();
                withOwn.Add(ownId.Value);
                return withOwn;
            }
        }

        return allowed;
    }

    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(ClaimsPrincipal user, AppDbContext db, string action = "Read", bool excludeSelfForApprovalList = false)
    {
        var leaveRbacIds = await ResolveLeaveRbacScopeIdsAsync(user, db, action, excludeSelfForApprovalList);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
        var allowed = PeopleAccessHelper.IntersectEmployeeScopes(leaveRbacIds, dimensionIds);

        // ESS: linked accounts can always access their own leave (balances, apply, mobile home).
        if (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
            || string.Equals(action, "Create", StringComparison.OrdinalIgnoreCase)
            || string.Equals(action, "Update", StringComparison.OrdinalIgnoreCase))
        {
            var ownId = await GetCurrentEmployeeIdAsync(user, db);
            if (ownId.HasValue && allowed != null && !allowed.Contains(ownId.Value))
            {
                var withOwn = allowed.ToList();
                withOwn.Add(ownId.Value);
                return withOwn;
            }
        }

        return allowed;
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
        return await ResolveEmployeeIdsForScopeAsync(user, db, scope, excludeSelfForApprovalList);
    }

    internal static Task<IReadOnlyList<Guid>?> ResolveEmployeeIdsForScopeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string scope,
        bool excludeSelfForApprovalList)
        => ModuleRbacHelper.ResolveEmployeeIdsForScopeAsync(user, db, scope, excludeSelfForApprovalList);

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

        var scopes = user.FindAll("permission")
            .Select(c => c.Value)
            .Select(p => ApprovalsAccessHelper.TryParseModuleActionScope(p, "Leave", action))
            .Where(s => s != null)
            .Select(s => s!)
            .ToList();

        if (scopes.Any(s => s.Equals("All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (scopes.Any(s => s.Equals("Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (scopes.Any(s => s.Equals("Own", StringComparison.OrdinalIgnoreCase)))
            return "Own";

        // Approvals UI treats Supervisor as team leave readers even when Leave:Read is missing from JWT.
        if (UserHasRole(user, "SUPERVISOR")
            && (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Update", StringComparison.OrdinalIgnoreCase)))
            return "Team";

        return "None";
    }

    public static Guid? GetCurrentEmployeeId(ClaimsPrincipal user)
    {
        var employeeIdStr = user.FindFirstValue("employeeId");
        if (string.IsNullOrEmpty(employeeIdStr) || !Guid.TryParse(employeeIdStr, out var id))
            return null;
        return id;
    }

    /// <summary>Linked employee (JWT claim, then DB <see cref="Domain.Entities.User.EmployeeId"/>).</summary>
    public static Task<Guid?> GetCurrentEmployeeIdAsync(ClaimsPrincipal user, AppDbContext db)
        => PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);

    public static async Task<bool> CanAccessEmployeeLeaveAsync(ClaimsPrincipal user, AppDbContext db, Guid employeeId, string action = "Read")
    {
        var ownId = await GetCurrentEmployeeIdAsync(user, db);
        if (ownId == employeeId
            && (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Create", StringComparison.OrdinalIgnoreCase)))
            return true;

        var allowedIds = await GetAllowedEmployeeIdsAsync(user, db, action);
        if (allowedIds == null)
            return true;
        return allowedIds.Contains(employeeId);
    }

    /// <summary>Read access for leave request listing (Leave + Approvals scopes).</summary>
    public static async Task<bool> CanAccessEmployeeLeaveRequestListAsync(ClaimsPrincipal user, AppDbContext db, Guid employeeId)
    {
        var ownId = await GetCurrentEmployeeIdAsync(user, db);
        if (ownId == employeeId)
            return true;

        var allowedIds = await GetLeaveRequestsAllowedEmployeeIdsAsync(user, db);
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
