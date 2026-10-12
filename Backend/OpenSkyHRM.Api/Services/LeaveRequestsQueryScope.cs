using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves employee filters for leave-request lists.
/// The Approvals workspace reads only Approvals → Read from the database.
/// Approvals → All returns every leave request, with no employee filter.
/// </summary>
public static class LeaveRequestsQueryScope
{
    public sealed record ResolvedQuery(
        bool Allowed,
        Guid? EffectiveEmployeeId,
        IReadOnlyList<Guid>? AllowedEmployeeIds,
        Guid? ExcludeEmployeeId,
        PagedResult<LeaveRequestDto>? EmptyResult);

    public static async Task<ResolvedQuery> ResolveAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        bool forApprovalsWorkspace,
        Guid? employeeId,
        bool excludeSelf,
        int page,
        int pageSize)
    {
        var scope = forApprovalsWorkspace
            ? await ResolveApprovalsReadScopeFromDatabaseAsync(user, db)
            : await ResolveListReadScopeAsync(user, db);

        if (forApprovalsWorkspace && scope.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            // Same list as Admin: every leave request, including when this login is linked to an employee.
            return new ResolvedQuery(true, null, null, null, null);
        }

        Guid? effectiveEmployeeId = employeeId;
        IReadOnlyList<Guid>? allowedIds = null;
        Guid? excludeEmployeeId = null;

        if (scope is not ("Own" or "Team" or "All"))
        {
            return new ResolvedQuery(false, null, null, null, Empty(page, pageSize));
        }

        if (scope == "All")
        {
            // Company-wide. Do not pin the list to the signed-in employee or dimension filters.
            // An explicit employeeId (for example "my leave") still narrows the query.
            return new ResolvedQuery(true, employeeId, null, null, null);
        }

        if (scope == "Own")
        {
            var currentId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db);
            if (!currentId.HasValue)
            {
                // An account with no linked employee cannot be pinned to "own".
                // Approvals → All never reaches this branch.
                if (forApprovalsWorkspace)
                    return new ResolvedQuery(true, null, Array.Empty<Guid>(), null, Empty(page, pageSize));
                return new ResolvedQuery(false, null, null, null, null);
            }
            effectiveEmployeeId = currentId;
        }
        else if (scope == "Team")
        {
            allowedIds = await ModuleRbacHelper.ResolveEmployeeIdsForScopeAsync(
                user, db, "Team", excludeSelfFromTeam: excludeSelf);
            if (excludeSelf)
                excludeEmployeeId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db);
            if (allowedIds is { Count: 0 })
            {
                return new ResolvedQuery(
                    true,
                    effectiveEmployeeId,
                    allowedIds,
                    excludeEmployeeId,
                    Empty(page, pageSize));
            }
        }

        if (effectiveEmployeeId.HasValue)
        {
            if (scope == "Own")
            {
                var currentId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db);
                if (currentId != effectiveEmployeeId)
                    return new ResolvedQuery(false, null, null, null, null);
            }
            else if (allowedIds != null && !allowedIds.Contains(effectiveEmployeeId.Value))
            {
                return new ResolvedQuery(false, null, null, null, null);
            }
        }

        return new ResolvedQuery(true, effectiveEmployeeId, allowedIds, excludeEmployeeId, null);
    }

    /// <summary>
    /// Approvals → Read from the user's roles in the database only.
    /// Leave permissions are not used. A missing employee link does not remove Approvals → All.
    /// </summary>
    internal static async Task<string> ResolveApprovalsReadScopeFromDatabaseAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var roleIds = new HashSet<Guid>();

        var userId = await ResolveUserAccountIdAsync(user, db);
        if (userId.HasValue)
        {
            var assigned = await db.UserRoles.AsNoTracking()
                .Where(ur => ur.UserId == userId.Value && !ur.IsDeleted)
                .Select(ur => ur.RoleId)
                .ToListAsync();
            foreach (var id in assigned)
                roleIds.Add(id);
        }

        var roleCodes = GetRoleCodes(user);
        if (roleCodes.Count > 0)
        {
            var roles = await db.SecurityRoles.AsNoTracking()
                .Where(r => !r.IsDeleted)
                .Select(r => new { r.Id, r.Code, r.Name })
                .ToListAsync();
            foreach (var role in roles)
            {
                if (roleCodes.Contains(role.Code) || roleCodes.Contains(role.Name))
                    roleIds.Add(role.Id);
            }
        }

        if (roleIds.Count == 0)
            return IsAdmin(user) ? "All" : "None";

        var codes = await db.SecurityRoles.AsNoTracking()
            .Where(r => !r.IsDeleted && roleIds.Contains(r.Id))
            .Select(r => r.Code)
            .ToListAsync();
        if (codes.Any(c => c.Equals("ADMIN", StringComparison.OrdinalIgnoreCase)
            || c.Equals("Admin", StringComparison.OrdinalIgnoreCase)))
            return "All";

        var rows = await db.Permissions.AsNoTracking()
            .Where(p => !p.IsDeleted && roleIds.Contains(p.RoleId))
            .Select(p => new { p.Module, p.Action, p.Scope })
            .ToListAsync();

        var scopes = rows
            .Where(p => p.Module.Equals("Approvals", StringComparison.OrdinalIgnoreCase)
                && p.Action.Equals("Read", StringComparison.OrdinalIgnoreCase))
            .Select(p => p.Scope);

        var fromDb = HighestScope(scopes);
        if (fromDb is not ("All" or "Team" or "Own"))
            fromDb = "None";

        // A saved Approvals → All must beat a stale Team/Own claim.
        // A token that already says Approvals → All is enough when the role row cannot be read.
        var fromToken = ApprovalsAccessHelper.ResolveScope(user, "Read");
        if (fromToken is not ("All" or "Team" or "Own"))
            return fromDb;
        return RbacScopeHelper.MaxScope(fromDb, fromToken);
    }

    /// <summary>Wider of Leave and Approvals Read on the user's roles. Approvals All beats Leave Own.</summary>
    internal static async Task<string> ResolveListReadScopeAsync(ClaimsPrincipal user, AppDbContext db)
    {
        if (IsAdmin(user))
            return "All";

        var userId = GetUserAccountId(user);
        if (userId.HasValue)
        {
            var roleRows = await db.UserRoles.AsNoTracking()
                .Where(ur => ur.UserId == userId.Value && !ur.IsDeleted)
                .Select(ur => new { ur.RoleId, ur.Role.Code, RoleDeleted = ur.Role.IsDeleted })
                .ToListAsync();

            var liveRoles = roleRows.Where(r => !r.RoleDeleted).ToList();
            if (liveRoles.Any(r => string.Equals(r.Code, "ADMIN", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Code, "Admin", StringComparison.OrdinalIgnoreCase)))
                return "All";

            var roleIds = liveRoles.Select(r => r.RoleId).ToList();
            if (roleIds.Count > 0)
            {
                var scopes = await db.Permissions.AsNoTracking()
                    .Where(p => !p.IsDeleted
                        && roleIds.Contains(p.RoleId)
                        && p.Action == "Read"
                        && (p.Module == "Approvals" || p.Module == "Leave"))
                    .Select(p => p.Scope)
                    .ToListAsync();

                var fromDb = HighestScope(scopes);
                if (fromDb is "All" or "Team" or "Own")
                    return fromDb;
            }
        }

        return RbacScopeHelper.MaxScope(
            ApprovalsAccessHelper.ResolveScope(user, "Read"),
            LeaveAccessHelper.ResolveScope(user, "Read"));
    }

    private static string HighestScope(IEnumerable<string?> scopes)
    {
        var best = "None";
        foreach (var scope in scopes)
        {
            var normalized = string.IsNullOrWhiteSpace(scope) ? "All" : scope.Trim();
            if (normalized.Equals("All", StringComparison.OrdinalIgnoreCase)) normalized = "All";
            else if (normalized.Equals("Team", StringComparison.OrdinalIgnoreCase)) normalized = "Team";
            else if (normalized.Equals("Own", StringComparison.OrdinalIgnoreCase)) normalized = "Own";
            else normalized = "None";
            best = RbacScopeHelper.MaxScope(best, normalized);
        }

        return best;
    }

    private static PagedResult<LeaveRequestDto> Empty(int page, int pageSize) =>
        new()
        {
            Items = new List<LeaveRequestDto>(),
            TotalCount = 0,
            Page = page,
            PageSize = pageSize,
        };

    private static async Task<Guid?> ResolveUserAccountIdAsync(ClaimsPrincipal user, AppDbContext db)
    {
        foreach (var claim in user.Claims)
        {
            if (!IsUserIdClaim(claim.Type))
                continue;
            if (!Guid.TryParse(claim.Value, out var id) || id == Guid.Empty)
                continue;
            var exists = await db.Users.AsNoTracking()
                .AnyAsync(u => u.Id == id && !u.IsDeleted);
            if (exists)
                return id;
        }

        var username = user.FindFirstValue("username")
            ?? user.FindFirstValue("unique_name");
        if (string.IsNullOrWhiteSpace(username))
            return null;

        var normalized = username.Trim().ToLower();
        return await db.Users.AsNoTracking()
            .Where(u => !u.IsDeleted && u.Username.ToLower() == normalized)
            .Select(u => (Guid?)u.Id)
            .FirstOrDefaultAsync();
    }

    private static bool IsUserIdClaim(string type) =>
        type == ClaimTypes.NameIdentifier
        || type == JwtRegisteredClaimNames.Sub
        || type.Equals("sub", StringComparison.OrdinalIgnoreCase)
        || type.Equals("nameid", StringComparison.OrdinalIgnoreCase)
        || type.EndsWith("/nameidentifier", StringComparison.OrdinalIgnoreCase);

    private static Guid? GetUserAccountId(ClaimsPrincipal user)
    {
        foreach (var claim in user.Claims)
        {
            if (!IsUserIdClaim(claim.Type))
                continue;
            if (Guid.TryParse(claim.Value, out var id) && id != Guid.Empty)
                return id;
        }

        return null;
    }

    private static HashSet<string> GetRoleCodes(ClaimsPrincipal user)
    {
        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var claim in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
        {
            if (!string.IsNullOrWhiteSpace(claim.Value))
                codes.Add(claim.Value.Trim());
        }

        return codes;
    }

    private static bool IsAdmin(ClaimsPrincipal user)
    {
        if (user.IsInRole("ADMIN")) return true;
        foreach (var c in user.FindAll(ClaimTypes.Role).Concat(user.FindAll("role")))
        {
            if (string.Equals(c.Value, "ADMIN", StringComparison.OrdinalIgnoreCase)
                || string.Equals(c.Value, "Admin", StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }
}
