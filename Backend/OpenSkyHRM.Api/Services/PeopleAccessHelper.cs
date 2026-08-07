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
/// Dimension restrictions always apply — ADMIN / People:All cannot bypass them.
/// </summary>
public static class PeopleAccessHelper
{
    private static Guid? GetCurrentUserAccountId(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue("sub");
        return Guid.TryParse(s, out var id) ? id : null;
    }

    private static bool UserHasRole(ClaimsPrincipal user, string roleCode)
    {
        if (user.IsInRole(roleCode)) return true;
        foreach (var c in user.FindAll(ClaimTypes.Role))
        {
            if (string.Equals(c.Value, roleCode, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        foreach (var c in user.FindAll("role"))
        {
            if (string.Equals(c.Value, roleCode, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        if (string.Equals(roleCode, "ADMIN", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var c in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
            {
                if (string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase))
                    return true;
            }
        }

        return false;
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

    /// <summary>
    /// Returns employee IDs matching configured dimension assignments, or null when no dimension restrictions exist.
    /// </summary>
    private static async Task<List<Guid>?> BuildDimensionFilteredEmployeeIdsAsync(
        AppDbContext db,
        IReadOnlyList<Guid>? assignedLocs,
        IReadOnlyList<Guid>? assignedBus,
        IReadOnlyList<Guid>? assignedGrades,
        IReadOnlyList<Guid>? assignedJobTitles)
    {
        var hasAssignmentFilters =
            assignedLocs != null || assignedBus != null || assignedGrades != null || assignedJobTitles != null;

        if (!hasAssignmentFilters)
            return null;

        var q = db.Employees.AsNoTracking().AsQueryable();

        if (assignedLocs != null)
            q = q.Where(e => e.LocationId.HasValue && assignedLocs.Contains(e.LocationId.Value));

        if (assignedBus != null)
            q = q.Where(e => e.BusinessUnitId.HasValue && assignedBus.Contains(e.BusinessUnitId.Value));

        if (assignedGrades != null)
            q = q.Where(e => e.GradeId.HasValue && assignedGrades.Contains(e.GradeId.Value));

        if (assignedJobTitles != null)
            q = q.Where(e => e.JobTitleId.HasValue && assignedJobTitles.Contains(e.JobTitleId.Value));

        return await q.Select(e => e.Id).ToListAsync();
    }

    /// <summary>
    /// Returns employee IDs matching the user's dimension assignments, or null when no dimension restrictions exist.
    /// </summary>
    public static async Task<IReadOnlyList<Guid>?> GetDimensionFilteredEmployeeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db)
    {
        var assignedLocs = await GetAssignedLocationIdsAsync(user, db);
        var assignedBus = await GetAssignedBusinessUnitIdsAsync(user, db);
        var assignedGrades = await GetAssignedGradeIdsAsync(user, db);
        var assignedJobTitles = await GetAssignedJobTitleIdsAsync(user, db);

        return await BuildDimensionFilteredEmployeeIdsAsync(
            db, assignedLocs, assignedBus, assignedGrades, assignedJobTitles);
    }

    /// <summary>
    /// Combines two employee scope layers. Null means unrestricted for that layer; both lists are intersected.
    /// </summary>
    public static IReadOnlyList<Guid>? IntersectEmployeeScopes(
        IReadOnlyList<Guid>? rbacScopeIds,
        IReadOnlyList<Guid>? dimensionScopeIds)
    {
        if (dimensionScopeIds != null)
        {
            if (rbacScopeIds == null)
                return dimensionScopeIds;
            return rbacScopeIds.Where(id => dimensionScopeIds.Contains(id)).ToList();
        }

        return rbacScopeIds;
    }

    /// <summary>
    /// Linked employee for the signed-in account (JWT claim, then DB <see cref="User.EmployeeId"/>).
    /// </summary>
    public static async Task<Guid?> ResolveOwnEmployeeIdAsync(ClaimsPrincipal user, AppDbContext db)
    {
        if (Guid.TryParse(user.FindFirstValue("employeeId"), out var fromClaim) && fromClaim != Guid.Empty)
            return fromClaim;

        var userId = GetCurrentUserAccountId(user);
        if (!userId.HasValue)
            return null;

        return await db.Set<User>()
            .AsNoTracking()
            .Where(u => u.Id == userId.Value)
            .Select(u => u.EmployeeId)
            .FirstOrDefaultAsync();
    }

    /// <summary>
    /// Resolves RBAC People scope (Own / Team / All). Returns null for unrestricted RBAC scope (All / ADMIN).
    /// </summary>
    private static async Task<IReadOnlyList<Guid>?> ResolveRbacScopeIdsAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action)
    {
        if (UserHasRole(user, "ADMIN"))
            return null;

        var permissions = user.FindAll("permission").Select(c => c.Value).ToList();
        var scope = ResolvePeopleScope(permissions, action);

        if (scope == "All")
            return null;

        if (scope == "Own")
        {
            var ownId = await ResolveOwnEmployeeIdAsync(user, db);
            if (!ownId.HasValue)
                return Array.Empty<Guid>();
            return new[] { ownId.Value };
        }

        if (scope == "Team")
        {
            var tid = await ResolveOwnEmployeeIdAsync(user, db);
            if (!tid.HasValue)
                return Array.Empty<Guid>();

            var teamIds = await db.Employees
                .AsNoTracking()
                .Where(e => e.Id == tid.Value || e.ManagerId == tid.Value)
                .Select(e => e.Id)
                .ToListAsync();
            return teamIds;
        }

        return Array.Empty<Guid>();
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

        var dimensionIds = await BuildDimensionFilteredEmployeeIdsAsync(
            db, assignedLocs, assignedBus, assignedGrades, assignedJobTitles);

        var scopeIds = await ResolveRbacScopeIdsAsync(user, db, action);
        var allowed = IntersectEmployeeScopes(scopeIds, dimensionIds);

        // ESS: every linked account can always read/update their own employee profile
        // (mobile profile + attendance), even without People RBAC or when dimension filters exclude them.
        if (string.Equals(action, "Read", StringComparison.OrdinalIgnoreCase)
            || string.Equals(action, "Update", StringComparison.OrdinalIgnoreCase))
        {
            var ownId = await ResolveOwnEmployeeIdAsync(user, db);
            if (ownId.HasValue && allowed != null && !allowed.Contains(ownId.Value))
            {
                var withOwn = allowed.ToList();
                withOwn.Add(ownId.Value);
                return withOwn;
            }
        }

        return allowed;
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
