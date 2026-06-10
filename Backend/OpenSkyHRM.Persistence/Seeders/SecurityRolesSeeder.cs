using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Ensures default system roles (Admin, HR Manager, Supervisor, Employee) exist in every tenant database.
/// Idempotent: does not change permissions on roles that already have any permission rows.
/// </summary>
public static class SecurityRolesSeeder
{
    private static readonly string[] AllModules =
    {
        "Dashboard", "People", "Leave", "Attendance", "Payroll", "Performance", "Learning",
        "OrgStructure", "Analytics", "Settings", "Administration", "Billing"
    };

    private static readonly string[] HrManagerModules =
    {
        "Dashboard", "People", "Leave", "Attendance", "Payroll", "Performance", "Learning",
        "OrgStructure", "Analytics", "Settings", "Administration"
    };

    private static readonly string[] AllActions = { "Create", "Read", "Update", "Delete" };

    public static async Task EnsureAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        await EnsureRoleAsync(
            context,
            "ADMIN",
            "Admin",
            "Full system access",
            isSystemRole: true,
            BuildAllActionsAllScope(AllModules),
            cancellationToken);

        await EnsureRoleAsync(
            context,
            "HR_MANAGER",
            "HR Manager",
            "HR operations and employee lifecycle",
            isSystemRole: true,
            BuildAllActionsAllScope(HrManagerModules),
            cancellationToken);

        await EnsureRoleAsync(
            context,
            "SUPERVISOR",
            "Supervisor",
            "Team-level visibility and approvals",
            isSystemRole: true,
            BuildSupervisorPermissions(),
            cancellationToken);

        await EnsureRoleAsync(
            context,
            "EMPLOYEE",
            "Employee",
            "Self-service access for individual employees",
            isSystemRole: true,
            BuildEmployeePermissions(),
            cancellationToken);

        await EnsureRoleHasPermissionsAsync(context, "EMPLOYEE", BuildEmployeePermissions(), cancellationToken);
    }

    private static async Task EnsureRoleAsync(
        AppDbContext context,
        string code,
        string name,
        string description,
        bool isSystemRole,
        IReadOnlyList<(string Module, string Action, string Scope)> permissions,
        CancellationToken cancellationToken)
    {
        var role = await context.SecurityRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Code == code && !r.IsDeleted, cancellationToken);

        if (role == null)
        {
            role = new SecurityRole
            {
                Name = name,
                Code = code,
                Description = description,
                IsSystemRole = isSystemRole
            };
            context.SecurityRoles.Add(role);
            await context.SaveChangesAsync(cancellationToken);
        }
        else
        {
            if (string.IsNullOrWhiteSpace(role.Name))
                role.Name = name;
            if (string.IsNullOrWhiteSpace(role.Description))
                role.Description = description;
            role.IsSystemRole = isSystemRole;
        }

        if (role.Permissions.Any(p => !p.IsDeleted))
            return;

        foreach (var (module, action, scope) in permissions)
        {
            role.Permissions.Add(new Permission
            {
                RoleId = role.Id,
                Module = module,
                Action = action,
                Scope = scope
            });
        }

        await context.SaveChangesAsync(cancellationToken);
    }

    private static List<(string Module, string Action, string Scope)> BuildAllActionsAllScope(
        IEnumerable<string> modules)
    {
        var list = new List<(string, string, string)>();
        foreach (var module in modules)
            foreach (var action in AllActions)
                list.Add((module, action, "All"));
        return list;
    }

    private static List<(string Module, string Action, string Scope)> BuildSupervisorPermissions()
    {
        var list = new List<(string, string, string)>
        {
            ("Dashboard", "Read", "All"),
            ("People", "Read", "Team"),
            ("Leave", "Read", "Team"),
            ("Leave", "Create", "Team"),
            ("Leave", "Update", "Team"),
            ("Attendance", "Read", "Team"),
            ("Attendance", "Update", "Team"),
            ("Performance", "Read", "Team"),
            ("Performance", "Update", "Team"),
            ("Learning", "Read", "Team"),
            ("Analytics", "Read", "Team"),
        };
        return list;
    }

    private static List<(string Module, string Action, string Scope)> BuildEmployeePermissions()
    {
        return new List<(string, string, string)>
        {
            ("Dashboard", "Read", "Own"),
            ("People", "Read", "Own"),
            ("People", "Create", "Own"),
            ("People", "Update", "Own"),
            ("Leave", "Read", "Own"),
            ("Leave", "Create", "Own"),
            ("Leave", "Update", "Own"),
            ("Attendance", "Read", "Own"),
            ("Performance", "Read", "Own"),
            ("Learning", "Read", "Own"),
        };
    }

    /// <summary>
    /// Adds any missing default permissions to an existing system role (idempotent patch for upgraded tenants).
    /// </summary>
    private static async Task EnsureRoleHasPermissionsAsync(
        AppDbContext context,
        string roleCode,
        IReadOnlyList<(string Module, string Action, string Scope)> required,
        CancellationToken cancellationToken)
    {
        var role = await context.SecurityRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Code == roleCode && !r.IsDeleted, cancellationToken);
        if (role == null) return;

        var existing = role.Permissions
            .Where(p => !p.IsDeleted)
            .Select(p => (p.Module, p.Action, p.Scope))
            .ToHashSet();

        var added = false;
        foreach (var perm in required)
        {
            if (existing.Contains(perm)) continue;
            role.Permissions.Add(new Permission
            {
                RoleId = role.Id,
                Module = perm.Module,
                Action = perm.Action,
                Scope = perm.Scope
            });
            added = true;
        }

        if (added)
            await context.SaveChangesAsync(cancellationToken);
    }
}
