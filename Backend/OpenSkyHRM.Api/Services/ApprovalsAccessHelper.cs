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

        var scopes = user.FindAll("permission")
            .Select(c => c.Value)
            .Select(p => TryParseModuleActionScope(p, "Approvals", action))
            .Where(s => s != null)
            .Select(s => s!)
            .ToList();

        if (scopes.Any(s => s.Equals("All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (scopes.Any(s => s.Equals("Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (scopes.Any(s => s.Equals("Own", StringComparison.OrdinalIgnoreCase)))
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
        var scope = await LeaveRequestsQueryScope.ResolveApprovalsReadScopeAsync(user, db, action);
        if (string.Equals(scope, "All", StringComparison.OrdinalIgnoreCase))
            return null;
        if (!string.Equals(scope, "Team", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(scope, "Own", StringComparison.OrdinalIgnoreCase))
            return Array.Empty<Guid>();

        return await LeaveAccessHelper.ResolveEmployeeIdsForScopeAsync(
            user, db, scope, excludeSelfForApprovalList);
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

    /// <summary>Parses JWT permission claims (<c>Module:Action:Scope</c>). Empty scope defaults to All.</summary>
    internal static string? TryParseModuleActionScope(string claim, string module, string action)
    {
        if (string.IsNullOrWhiteSpace(claim))
            return null;
        var parts = claim.Split(':', 3, StringSplitOptions.TrimEntries);
        if (parts.Length < 2)
            return null;
        if (!parts[0].Equals(module, StringComparison.OrdinalIgnoreCase))
            return null;
        if (!parts[1].Equals(action, StringComparison.OrdinalIgnoreCase))
            return null;
        if (parts.Length == 2 || string.IsNullOrWhiteSpace(parts[2]))
            return "All";
        return parts[2];
    }
}
