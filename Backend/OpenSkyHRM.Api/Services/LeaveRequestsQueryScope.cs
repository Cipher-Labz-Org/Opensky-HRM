using System.Security.Claims;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Services;

/// <summary>
/// Resolves employee filters for GET leave request lists (Leave module vs Approvals workspace).
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
            ? ApprovalsAccessHelper.ResolveScope(user, "Read")
            : LeaveAccessHelper.ResolveScope(user, "Read");

        Guid? effectiveEmployeeId = employeeId;
        IReadOnlyList<Guid>? allowedIds = null;
        Guid? excludeEmployeeId = null;

        if (scope is not ("Own" or "Team" or "All"))
        {
            return new ResolvedQuery(
                false,
                null,
                null,
                null,
                new PagedResult<LeaveRequestDto>
                {
                    Items = new List<LeaveRequestDto>(),
                    TotalCount = 0,
                    Page = page,
                    PageSize = pageSize,
                });
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
            allowedIds = forApprovalsWorkspace
                ? await ApprovalsAccessHelper.GetAllowedEmployeeIdsAsync(user, db, "Read", excludeSelfForApprovalList: excludeSelf)
                : await LeaveAccessHelper.GetAllowedEmployeeIdsAsync(user, db, "Read", excludeSelfForApprovalList: excludeSelf);
            if (excludeSelf)
                excludeEmployeeId = await LeaveAccessHelper.GetCurrentEmployeeIdAsync(user, db);
            if (allowedIds is { Count: 0 })
            {
                return new ResolvedQuery(
                    true,
                    effectiveEmployeeId,
                    allowedIds,
                    excludeEmployeeId,
                    new PagedResult<LeaveRequestDto>
                    {
                        Items = new List<LeaveRequestDto>(),
                        TotalCount = 0,
                        Page = page,
                        PageSize = pageSize,
                    });
            }
        }

        if (effectiveEmployeeId.HasValue)
        {
            var canAccess = forApprovalsWorkspace
                ? await ApprovalsAccessHelper.CanAccessEmployeeAsync(user, db, effectiveEmployeeId.Value, "Read")
                : await LeaveAccessHelper.CanAccessEmployeeLeaveAsync(user, db, effectiveEmployeeId.Value, "Read");
            if (!canAccess)
                return new ResolvedQuery(false, null, null, null, null);
        }

        return new ResolvedQuery(true, effectiveEmployeeId, allowedIds, excludeEmployeeId, null);
    }
}
