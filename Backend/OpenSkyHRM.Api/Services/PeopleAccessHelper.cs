using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves which employee IDs the current user can access based on People scope (Own, Team, All) and optional
/// assignment rows (<see cref="UserAssignedLocation"/>, <see cref="UserAssignedBusinessUnit"/>, <see cref="UserAssignedGrade"/>,
/// <see cref="UserAssignedJobTitle"/>). When any assignment set is non-empty for a dimension, the employee must match
/// that dimension (non-null field value in the allowed set). Multiple dimensions combine with AND.
/// </summary>
public static class PeopleAccessHelper
{
    private static Guid? GetCurrentUserAccountId(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Guid.TryParse(s, out var id) ? id : null;
    }

    /// <summary>
    /// Returns distinct location IDs assigned to the user account, or null when the user has no location rows
    /// (no location-based restriction).
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetAssignedLocationIdsAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = GetCurrentUserAccountId(user);
        if (!userId.HasValue) return null;

        var ids = await db.Set<UserAssignedLocation>()
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .Select(x => x.LocationId)
            .Distinct()
            .ToListAsync();

        return ids.Count == 0 ? null : ids;
    }

    /// <summary>
    /// Returns distinct business unit IDs assigned to the user account, or null when there are no BU rows.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetAssignedBusinessUnitIdsAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = GetCurrentUserAccountId(user);
        if (!userId.HasValue) return null;

        var ids = await db.Set<UserAssignedBusinessUnit>()
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .Select(x => x.BusinessUnitId)
            .Distinct()
            .ToListAsync();

        return ids.Count == 0 ? null : ids;
    }

    /// <summary>
    /// Returns distinct grade IDs assigned to the user account, or null when there are no grade rows.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetAssignedGradeIdsAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = GetCurrentUserAccountId(user);
        if (!userId.HasValue) return null;

        var ids = await db.Set<UserAssignedGrade>()
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .Select(x => x.GradeId)
            .Distinct()
            .ToListAsync();

        return ids.Count == 0 ? null : ids;
    }

    /// <summary>
    /// Returns distinct job title IDs assigned to the user account, or null when there are no job title rows.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetAssignedJobTitleIdsAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var userId = GetCurrentUserAccountId(user);
        if (!userId.HasValue) return null;

        var ids = await db.Set<UserAssignedJobTitle>()
            .AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .Select(x => x.JobTitleId)
            .Distinct()
            .ToListAsync();

        return ids.Count == 0 ? null : ids;
    }

    /// <summary>
    /// When the user has assigned locations, the employee's work location must be one of them (non-null).
    /// </summary>
    public static async Task<bool> MayAssignEmployeeLocationAsync(ClaimsPrincipal user, AppDbContext db, Guid? locationId)
    {
        var locs = await GetAssignedLocationIdsAsync(user, db);
        if (locs == null) return true;
        if (!locationId.HasValue) return false;
        return locs.Contains(locationId.Value);
    }

    public static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action = "Read")
    {
        var assignedLocs = await GetAssignedLocationIdsAsync(user, db);
        var assignedBus = await GetAssignedBusinessUnitIdsAsync(user, db);
        var assignedGrades = await GetAssignedGradeIdsAsync(user, db);
        var assignedJobTitles = await GetAssignedJobTitleIdsAsync(user, db);

        IReadOnlyList<Guid>? scopeIds;
        if (user.IsInRole("ADMIN"))
        {
            scopeIds = null;
        }
        else
        {
            var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
            var scope = ResolvePeopleScope(permissions, action);

            if (scope == "All")
                scopeIds = null;
            else if (scope == "Own")
            {
                if (!Guid.TryParse(user.FindFirstValue("employeeId"), out var ownId))
                    scopeIds = Array.Empty<Guid>();
                else
                    scopeIds = new[] { ownId };
            }
            else if (scope == "Team")
            {
                if (!Guid.TryParse(user.FindFirstValue("employeeId"), out var tid))
                    scopeIds = Array.Empty<Guid>();
                else
                {
                    var teamIds = await db.Employees
                        .AsNoTracking()
                        .Where(e => e.Id == tid || e.ManagerId == tid)
                        .Select(e => e.Id)
                        .ToListAsync();
                    scopeIds = teamIds;
                }
            }
            else
                scopeIds = Array.Empty<Guid>();
        }

        var hasAssignmentFilters =
            assignedLocs != null || assignedBus != null || assignedGrades != null || assignedJobTitles != null;

        if (!hasAssignmentFilters)
            return scopeIds;

        var q = db.Employees.AsNoTracking().AsQueryable();

        if (assignedLocs != null)
            q = q.Where(e => e.LocationId.HasValue && assignedLocs.Contains(e.LocationId.Value));

        if (assignedBus != null)
            q = q.Where(e => e.BusinessUnitId.HasValue && assignedBus.Contains(e.BusinessUnitId.Value));

        if (assignedGrades != null)
            q = q.Where(e => e.GradeId.HasValue && assignedGrades.Contains(e.GradeId.Value));

        if (assignedJobTitles != null)
            q = q.Where(e => e.JobTitleId.HasValue && assignedJobTitles.Contains(e.JobTitleId.Value));

        var filteredIds = await q.Select(e => e.Id).ToListAsync();

        if (scopeIds == null)
            return filteredIds;

        return scopeIds.Where(id => filteredIds.Contains(id)).ToList();
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
