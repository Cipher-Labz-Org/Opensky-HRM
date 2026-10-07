using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.AiAssistant;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Resolves employee access scope for AI tools (mirrors API PeopleAccessHelper logic).
/// </summary>
public class PeopleScopeService : IPeopleScopeService
{
    private readonly AppDbContext _db;

    public PeopleScopeService(AppDbContext db) => _db = db;

    public string ResolvePeopleScope(AiUserContext user, string action = "Read")
    {
        if (IsAdmin(user))
            return "All";
        return ResolvePeopleScopeStatic(user, action);
    }

    public Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsAsync(
        AiUserContext user,
        string action = "Read",
        CancellationToken ct = default) =>
        GetAllowedEmployeeIdsCoreAsync(user, _db, action, ct);

    public async Task<bool> CanAccessEmployeeAsync(
        AiUserContext user,
        Guid employeeId,
        string action = "Read",
        CancellationToken ct = default)
    {
        var allowed = await GetAllowedEmployeeIdsAsync(user, action, ct);
        if (allowed == null) return true;
        return allowed.Contains(employeeId);
    }

    internal static async Task<IReadOnlyList<Guid>?> GetAllowedEmployeeIdsCoreAsync(
        AiUserContext user,
        AppDbContext db,
        string action,
        CancellationToken ct)
    {
        var assignedLocs = await GetAssignedLocationIdsAsync(db, user.UserId, ct);
        var assignedBus = await GetAssignedBusinessUnitIdsAsync(db, user.UserId, ct);
        var assignedGrades = await GetAssignedGradeIdsAsync(db, user.UserId, ct);
        var assignedJobTitles = await GetAssignedJobTitleIdsAsync(db, user.UserId, ct);
        var assignedCompanyProfiles = await GetAssignedCompanyProfileKeysAsync(db, user.UserId, ct);

        if (IsAdmin(user))
            return null;

        var scope = ResolvePeopleScopeStatic(user, action);
        if (scope == "All")
            return null;

        IReadOnlyList<Guid>? scopeIds;
        if (scope == "Own")
            scopeIds = user.EmployeeId.HasValue ? new[] { user.EmployeeId.Value } : Array.Empty<Guid>();
        else if (scope == "Team")
        {
            if (!user.EmployeeId.HasValue)
                scopeIds = Array.Empty<Guid>();
            else
            {
                var graph = await ReportingChain.LoadAsync(db, ct);
                var teamIds = ReportingChain.GetDescendantIds(graph, user.EmployeeId.Value);
                teamIds.Add(user.EmployeeId.Value);
                scopeIds = teamIds.ToList();
            }
        }
        else
            scopeIds = Array.Empty<Guid>();

        var hasAssignmentFilters =
            assignedLocs != null || assignedBus != null || assignedGrades != null || assignedJobTitles != null
            || assignedCompanyProfiles != null;
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
        if (assignedCompanyProfiles != null)
            q = q.Where(e => assignedCompanyProfiles.Contains(e.CompanyProfileKey));

        var filteredIds = await q.Select(e => e.Id).ToListAsync(ct);
        if (scopeIds == null)
            return filteredIds;

        return scopeIds.Where(id => filteredIds.Contains(id)).ToList();
    }

    private static bool IsAdmin(AiUserContext user) =>
        user.Roles.Any(r => string.Equals(r, "ADMIN", StringComparison.OrdinalIgnoreCase));

    private static string ResolvePeopleScopeStatic(AiUserContext user, string action)
    {
        var peoplePerms = user.Permissions
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

    private static async Task<IReadOnlyList<Guid>?> GetAssignedLocationIdsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var ids = await db.Set<UserAssignedLocation>().AsNoTracking()
            .Where(x => x.UserId == userId).Select(x => x.LocationId).Distinct().ToListAsync(ct);
        return ids.Count == 0 ? null : ids;
    }

    private static async Task<IReadOnlyList<Guid>?> GetAssignedBusinessUnitIdsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var ids = await db.Set<UserAssignedBusinessUnit>().AsNoTracking()
            .Where(x => x.UserId == userId).Select(x => x.BusinessUnitId).Distinct().ToListAsync(ct);
        return ids.Count == 0 ? null : ids;
    }

    private static async Task<IReadOnlyList<Guid>?> GetAssignedGradeIdsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var ids = await db.Set<UserAssignedGrade>().AsNoTracking()
            .Where(x => x.UserId == userId).Select(x => x.GradeId).Distinct().ToListAsync(ct);
        return ids.Count == 0 ? null : ids;
    }

    private static async Task<IReadOnlyList<Guid>?> GetAssignedJobTitleIdsAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var ids = await db.Set<UserAssignedJobTitle>().AsNoTracking()
            .Where(x => x.UserId == userId).Select(x => x.JobTitleId).Distinct().ToListAsync(ct);
        return ids.Count == 0 ? null : ids;
    }

    private static async Task<IReadOnlyList<string>?> GetAssignedCompanyProfileKeysAsync(
        AppDbContext db,
        Guid userId,
        CancellationToken ct)
    {
        var keys = await db.Set<UserAssignedCompanyProfile>().AsNoTracking()
            .Where(x => x.UserId == userId)
            .Select(x => x.CompanyProfileKey)
            .Distinct()
            .ToListAsync(ct);
        return keys.Count == 0 ? null : keys;
    }
}
