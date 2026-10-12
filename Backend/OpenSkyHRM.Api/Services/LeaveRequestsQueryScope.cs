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
        if (forApprovalsWorkspace)
            return await ResolveApprovalsWorkspaceAsync(user, db, excludeSelf, page, pageSize);

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

    /// <summary>
    /// Approvals page only. Leave → Own must not limit this list.
    /// Approvals → All returns every leave request.
    /// </summary>
    private static async Task<ResolvedQuery> ResolveApprovalsWorkspaceAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        bool excludeSelf,
        int page,
        int pageSize)
    {
        var scope = await ResolveApprovalsReadScopeAsync(user, db);
        if (scope == "All")
            return new ResolvedQuery(true, null, null, null, null);

        if (scope == "Own")
        {
            var currentId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db);
            if (!currentId.HasValue)
                return new ResolvedQuery(false, null, null, null, null);
            return new ResolvedQuery(true, currentId, null, null, null);
        }

        if (scope == "Team")
        {
            var allowedIds = await ModuleRbacHelper.ResolveEmployeeIdsForScopeAsync(
                user, db, "Team", excludeSelfFromTeam: excludeSelf);
            Guid? excludeEmployeeId = excludeSelf
                ? await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db)
                : null;
            if (allowedIds is { Count: 0 })
                return new ResolvedQuery(true, null, allowedIds, excludeEmployeeId, Empty(page, pageSize));
            return new ResolvedQuery(true, null, allowedIds, excludeEmployeeId, null);
        }

        return new ResolvedQuery(false, null, null, null, Empty(page, pageSize));
    }

    internal static async Task<string> ResolveApprovalsReadScopeAsync(
        ClaimsPrincipal user,
        AppDbContext db,
        string action = "Read")
    {
        if (IsAdmin(user))
            return "All";

        var fromClaims = ApprovalsAccessHelper.ResolveScope(user, action);
        var userId = await ResolveUserIdAsync(user, db);
        if (!userId.HasValue)
            return fromClaims;

        var roleIds = await db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId.Value)
            .Select(ur => ur.RoleId)
            .ToListAsync();
        if (roleIds.Count == 0)
            return fromClaims;

        var roles = await db.SecurityRoles.AsNoTracking()
            .Where(r => roleIds.Contains(r.Id))
            .Select(r => new { r.Id, r.Code })
            .ToListAsync();
        if (roles.Any(r => string.Equals(r.Code, "ADMIN", StringComparison.OrdinalIgnoreCase)
            || string.Equals(r.Code, "Admin", StringComparison.OrdinalIgnoreCase)))
            return "All";

        var liveRoleIds = roles.Select(r => r.Id).ToList();
        var rows = await db.Permissions.AsNoTracking()
            .Where(p => liveRoleIds.Contains(p.RoleId))
            .Select(p => new { p.Module, p.Action, p.Scope })
            .ToListAsync();

        var approvalScopes = rows
            .Where(p => string.Equals((p.Module ?? "").Trim(), "Approvals", StringComparison.OrdinalIgnoreCase)
                && string.Equals((p.Action ?? "").Trim(), action.Trim(), StringComparison.OrdinalIgnoreCase))
            .Select(p => p.Scope)
            .ToList();

        return RbacScopeHelper.MaxScope(HighestScope(approvalScopes), fromClaims);
    }

    private static async Task<Guid?> ResolveUserIdAsync(ClaimsPrincipal user, AppDbContext db)
    {
        var direct = GetUserAccountId(user);
        if (direct.HasValue && await db.Users.AsNoTracking().AnyAsync(u => u.Id == direct.Value))
            return direct;

        var username = user.FindFirstValue("username") ?? user.Identity?.Name;
        if (!string.IsNullOrWhiteSpace(username))
        {
            var byName = await db.Users.AsNoTracking()
                .Where(u => u.Username == username)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();
            if (byName.HasValue)
                return byName;
        }

        var email = user.FindFirstValue(ClaimTypes.Email)
            ?? user.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? user.FindFirstValue("email");
        if (!string.IsNullOrWhiteSpace(email))
        {
            var byEmail = await db.Users.AsNoTracking()
                .Where(u => u.Email == email)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();
            if (byEmail.HasValue)
                return byEmail;
        }

        if (Guid.TryParse(user.FindFirstValue("employeeId"), out var employeeId) && employeeId != Guid.Empty)
        {
            var byEmployee = await db.Users.AsNoTracking()
                .Where(u => u.EmployeeId == employeeId)
                .Select(u => (Guid?)u.Id)
                .FirstOrDefaultAsync();
            if (byEmployee.HasValue)
                return byEmployee;
        }

        return direct;
    }

    /// <summary>Wider of Leave and Approvals Read on the user's roles. Approvals All beats Leave Own.</summary>
    internal static async Task<string> ResolveListReadScopeAsync(ClaimsPrincipal user, AppDbContext db)
    {
        if (IsAdmin(user))
            return "All";

        var userId = await ResolveUserIdAsync(user, db);
        if (userId.HasValue)
        {
            var roleRows = await db.UserRoles.AsNoTracking()
                .Where(ur => ur.UserId == userId.Value)
                .Select(ur => new { ur.RoleId, ur.Role.Code })
                .ToListAsync();

            if (roleRows.Any(r => string.Equals(r.Code, "ADMIN", StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.Code, "Admin", StringComparison.OrdinalIgnoreCase)))
                return "All";

            var roleIds = roleRows.Select(r => r.RoleId).Distinct().ToList();
            if (roleIds.Count > 0)
            {
                var rows = await db.Permissions.AsNoTracking()
                    .Where(p => roleIds.Contains(p.RoleId))
                    .Select(p => new { p.Module, p.Action, p.Scope })
                    .ToListAsync();

                var scopes = rows
                    .Where(p => string.Equals((p.Module ?? "").Trim(), "Leave", StringComparison.OrdinalIgnoreCase)
                        && string.Equals((p.Action ?? "").Trim(), "Read", StringComparison.OrdinalIgnoreCase))
                    .Select(p => p.Scope);

                var fromDb = HighestScope(scopes);
                if (fromDb is "All" or "Team" or "Own")
                    return fromDb;
            }
        }

        return LeaveAccessHelper.ResolveScope(user, "Read");
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
