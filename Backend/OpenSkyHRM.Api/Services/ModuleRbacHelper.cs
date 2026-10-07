using System.Security.Claims;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves Own / Team / All employee access from JWT permissions for any RBAC module.
/// Team = full reporting subtree (<see cref="ReportingChain"/>), consistent with People Hub.
/// </summary>
public static class ModuleRbacHelper
{
    public static string ResolveScope(ClaimsPrincipal user, string module, string action = "Read")
    {
        if (UserHasRole(user, "ADMIN"))
            return "All";

        var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
        var prefix = $"{module}:";
        var modulePerms = permissions
            .Where(p => p.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (modulePerms.Any(p => p.Contains($":{action}:All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (modulePerms.Any(p => p.Contains($":{action}:Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (modulePerms.Any(p => p.Contains($":{action}:Own", StringComparison.OrdinalIgnoreCase)))
            return "Own";

        return "None";
    }

    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string module,
        string action = "Read",
        bool excludeSelfFromTeam = false,
        bool ensureOwnForLinkedAccount = true)
    {
        if (UserHasRole(user, "ADMIN"))
        {
            var adminDim = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
            return PeopleAccessHelper.IntersectEmployeeScopes(null, adminDim);
        }

        var scope = ResolveScope(user, module, action);
        if (scope == "None")
            return Array.Empty<Guid>();

        var rbacIds = await ResolveEmployeeIdsForScopeAsync(user, db, scope, excludeSelfFromTeam);
        var dimensionIds = await PeopleAccessHelper.GetDimensionFilteredEmployeeIdsAsync(user, db);
        var allowed = PeopleAccessHelper.IntersectEmployeeScopes(rbacIds, dimensionIds);

        if (ensureOwnForLinkedAccount
            && (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Update", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Create", StringComparison.OrdinalIgnoreCase)))
        {
            var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);
            if (ownId.HasValue && allowed != null && !allowed.Contains(ownId.Value))
            {
                var withOwn = allowed.ToList();
                withOwn.Add(ownId.Value);
                return withOwn;
            }
        }

        return allowed;
    }

    public static async Task<bool> CanAccessEmployeeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        Guid employeeId,
        string module,
        string action = "Read")
    {
        var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);
        if (ownId == employeeId
            && (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
                || string.Equals(action, "Create", StringComparison.OrdinalIgnoreCase)))
            return true;

        var allowedIds = await GetAllowedEmployeeIdsAsync(user, db, module, action);
        if (allowedIds == null)
            return true;
        return allowedIds.Contains(employeeId);
    }

    /// <summary>True when any listed module grants access to the employee for the action.</summary>
    public static async Task<bool> CanAccessEmployeeViaAnyModuleAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        Guid employeeId,
        string action,
        params string[] modules)
    {
        var ownId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);
        if (ownId == employeeId
            && string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase))
            return true;

        foreach (var module in modules)
        {
            if (await CanAccessEmployeeAsync(user, db, employeeId, module, action))
                return true;
        }

        return false;
    }

    internal static async Task<IReadOnlyList<Guid>?> ResolveEmployeeIdsForScopeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string scope,
        bool excludeSelfFromTeam)
    {
        if (scope == "All")
            return null;

        var currentId = await PeopleAccessHelper.ResolveOwnEmployeeIdAsync(user, db);
        if (!currentId.HasValue)
            return Array.Empty<Guid>();

        if (scope == "Own")
            return new[] { currentId.Value };

        if (scope == "Team")
        {
            var graph = await ReportingChain.LoadAsync(db);
            var teamIds = ReportingChain.GetDescendantIds(graph, currentId.Value);
            if (excludeSelfFromTeam)
                teamIds.Remove(currentId.Value);
            else
                teamIds.Add(currentId.Value);
            return teamIds.ToList();
        }

        return Array.Empty<Guid>();
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

        return false;
    }
}
