using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves employee filters for leave-request lists.
/// Scope comes from the user's roles in the database (wider of Leave and Approvals Read),
/// so Approvals → All is not limited by Leave → Own or a stale login token.
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
        _ = forApprovalsWorkspace;

        var scope = await ResolveListReadScopeAsync(user, db);
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
                return new ResolvedQuery(false, null, null, null, null);
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

    private static Guid? GetUserAccountId(ClaimsPrincipal user)
    {
        var s = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue("sub");
        return Guid.TryParse(s, out var id) ? id : null;
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
