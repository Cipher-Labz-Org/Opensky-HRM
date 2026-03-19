using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves which employee IDs the current user can access based on People:Read scope (Own, Team, All).
/// </summary>
public static class PeopleAccessHelper
{
    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action = "Read")
    {
        if (user.IsInRole("ADMIN"))
            return null;

        var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
        var scope = ResolvePeopleScope(permissions, action);
        if (scope == "All")
            return null;

        var employeeIdStr = user.FindFirstValue("employeeId");
        if (string.IsNullOrEmpty(employeeIdStr) || !Guid.TryParse(employeeIdStr, out var currentEmployeeId))
            return Array.Empty<Guid>();

        if (scope == "Own")
            return new[] { currentEmployeeId };

        if (scope == "Team")
        {
            var teamIds = await db.Employees
                .Where(e => e.Id == currentEmployeeId || e.ManagerId == currentEmployeeId)
                .Select(e => e.Id)
                .ToListAsync();
            return teamIds;
        }

        return Array.Empty<Guid>();
    }

    public static string ResolvePeopleScope(IEnumerable<string> permissions, string action)
    {
        var peoplePerms = permissions
            .Where(p => p.StartsWith("People:", StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (peoplePerms.Any(p => p.Contains($":{action}:All", StringComparison.OrdinalIgnoreCase)))
            return "All";
        if (peoplePerms.Any(p => p.Contains($":{action}:Team", StringComparison.OrdinalIgnoreCase)))
            return "Team";
        if (peoplePerms.Any(p => p.Contains($":{action}:Own", StringComparison.OrdinalIgnoreCase)))
            return "Own";

        return "None";
    }

    /// <summary>
    /// Returns true if the current user can access the given employee for the specified action.
    /// </summary>
    public static async Task<bool> CanAccessEmployeeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        Guid employeeId,
        string action = "Read")
    {
        var allowedIds = await GetAllowedEmployeeIdsAsync(user, db, action);
        if (allowedIds == null)
            return true;
        return allowedIds.Contains(employeeId);
    }
}
