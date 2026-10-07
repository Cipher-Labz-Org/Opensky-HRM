using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves Approvals module scope (Own, Team, All) from JWT permissions.
/// Used for the Approvals workspace (leave / OT lists) independently of Leave &amp; Absence scope.
/// </summary>
public static class ApprovalsAccessHelper
{
    public static string ResolveScope(ClaimsPrincipal user, string action = "Read")
    {
        if (UserHasRole(user, "ADMIN"))
            return "All";

        var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
        var approvalsPerms = permissions
            .Where(p => p.StartsWith("Approvals:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (approvalsPerms.Any(p => p.Contains($":{action}:All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (approvalsPerms.Any(p => p.Contains($":{action}:Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (approvalsPerms.Any(p => p.Contains($":{action}:Own", StringComparison.OrdinalIgnoreCase)))
            return "Own";

        if (UserHasRole(user, "SUPERVISOR")
            && (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Update", StringComparison.OrdinalIgnoreCase)))
            return "Team";

        return "None";
    }

    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action = "Read",
        bool excludeSelfForApprovalList = false)
    {
        var rbacIds = await ResolveRbacScopeIdsAsync(user, db, action, excludeSelfForApprovalList);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
        return PeopleAccessHelper.IntersectEmployeeScopes(rbacIds, dimensionIds);
    }

    public static async Task<bool> CanAccessEmployeeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        Guid employeeId,
        string action = "Read")
    {
        var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);
        if (ownId == employeeId && string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase))
            return true;

        var allowedIds = await GetAllowedEmployeeIdsAsync(user, db, action);
        if (allowedIds == null)
            return true;
        return allowedIds.Contains(employeeId);
    }

    private static async Task<IReadOnlyList<Guid>?> ResolveRbacScopeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action,
        bool excludeSelfForApprovalList)
    {
        if (UserHasRole(user, "ADMIN"))
            return null;

        var scope = ResolveScope(user, action);
        return await LeaveAccessHelper.ResolveEmployeeIdsForScopeAsync(
            user, db, scope, excludeSelfForApprovalList);
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
}
