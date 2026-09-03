using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Security;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Ensures default system roles (Admin, HR Manager, Supervisor, Employee) exist in every tenant database.
/// Idempotent: does not change permissions on roles that already have any permission rows.
/// </summary>
public static class SecurityRolesSeeder
{
    private static readonly string[] AllModules =
    {
        "Dashboard", "People", "EmployeeBio", "Recruitment", "EmployeeTasks", "EmployeeActions",
        "Onboarding", "Offboarding", "Leave", "Approvals", "Attendance", "Payroll", "Performance",
        "Learning", "Reports", "OrgStructure", "Analytics", "Settings", "Billing", "AiAssistant",
        "EmailTemplates", "EmailDeliveryLog", "Administration", "UserManagement", "Help"
    };

    private static readonly string[] HrManagerModules =
    {
        "Dashboard", "People", "EmployeeBio", "Recruitment", "EmployeeTasks", "EmployeeActions",
        "Onboarding", "Offboarding", "Leave", "Approvals", "Attendance", "Payroll", "Performance",
        "Learning", "Reports", "OrgStructure", "Analytics", "Settings", "EmailTemplates",
        "EmailDeliveryLog", "Administration", "UserManagement", "Help"
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

        await EnsureRoleHasPermissionsAsync(context, "ADMIN", BuildAllActionsAllScope(AllModules), cancellationToken);
        await EnsureRoleHasPermissionsAsync(context, "HR_MANAGER", BuildAllActionsAllScope(HrManagerModules), cancellationToken);
        await EnsureRoleHasPermissionsAsync(context, "SUPERVISOR", BuildSupervisorPermissions(), cancellationToken);
        await EnsureRoleHasPermissionsAsync(context, "EMPLOYEE", BuildEmployeePermissions(), cancellationToken);
        await EnsureSidebarChildPermissionsAsync(context, cancellationToken);
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

        if (await context.Permissions.AnyAsync(p => p.RoleId == role.Id && !p.IsDeleted, cancellationToken))
            return;

        context.Permissions.AddRange(permissions.Select(p => new Permission
        {
            RoleId = role.Id,
            Module = p.Module,
            Action = p.Action,
            Scope = p.Scope,
        }));

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
            ("EmployeeBio", "Read", "Team"),
            ("EmployeeActions", "Read", "Team"),
            ("Leave", "Read", "Team"),
            ("Leave", "Create", "Team"),
            ("Leave", "Update", "Team"),
            ("Approvals", "Read", "Team"),
            ("Approvals", "Update", "Team"),
            ("Attendance", "Read", "Team"),
            ("Attendance", "Update", "Team"),
            ("Performance", "Read", "Team"),
            ("Performance", "Update", "Team"),
            ("Learning", "Read", "Team"),
            ("Reports", "Read", "Team"),
            ("Analytics", "Read", "Team"),
            ("Help", "Read", "All"),
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
            ("EmployeeBio", "Read", "Own"),
            ("EmployeeBio", "Create", "Own"),
            ("EmployeeBio", "Update", "Own"),
            ("EmployeeActions", "Read", "Own"),
            ("EmployeeActions", "Create", "Own"),
            ("EmployeeActions", "Update", "Own"),
            ("Leave", "Read", "Own"),
            ("Leave", "Create", "Own"),
            ("Leave", "Update", "Own"),
            ("Attendance", "Read", "Own"),
            ("Performance", "Read", "Own"),
            ("Learning", "Read", "Own"),
            ("Help", "Read", "Own"),
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
        var roleId = await context.SecurityRoles
            .Where(r => r.Code == roleCode && !r.IsDeleted)
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (roleId == Guid.Empty) return;

        var existing = await context.Permissions
            .Where(p => p.RoleId == roleId && !p.IsDeleted)
            .Select(p => new { p.Module, p.Action, p.Scope })
            .ToListAsync(cancellationToken);

        var existingSet = existing
            .Select(p => (p.Module, p.Action, p.Scope))
            .ToHashSet();

        var toAdd = new List<Permission>();
        foreach (var perm in required)
        {
            if (existingSet.Contains(perm)) continue;
            toAdd.Add(new Permission
            {
                RoleId = roleId,
                Module = perm.Module,
                Action = perm.Action,
                Scope = perm.Scope,
            });
        }

        if (toAdd.Count == 0) return;

        context.Permissions.AddRange(toAdd);
        await context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Copies parent-module permissions onto new sidebar rows so existing roles keep the same menus.
    /// Admins can then uncheck individual items (Employee bio, Approvals, User Management, …).
    /// </summary>
    private static async Task EnsureSidebarChildPermissionsAsync(AppDbContext context, CancellationToken cancellationToken)
    {
        var roles = await context.SecurityRoles
            .Include(r => r.Permissions)
            .Where(r => !r.IsDeleted)
            .ToListAsync(cancellationToken);

        var added = false;
        foreach (var role in roles)
        {
            var live = role.Permissions.Where(p => !p.IsDeleted).ToList();
            var existing = live
                .Select(p => (p.Module, p.Action, p.Scope))
                .ToHashSet();

            foreach (var (parent, child) in RolePermissionCatalog.ParentToChildCopies)
            {
                foreach (var perm in live.Where(p => p.Module == parent))
                {
                    var key = (child, perm.Action, perm.Scope);
                    if (existing.Contains(key)) continue;
                    context.Permissions.Add(new Permission
                    {
                        RoleId = role.Id,
                        Module = child,
                        Action = perm.Action,
                        Scope = perm.Scope,
                    });
                    existing.Add(key);
                    added = true;
                }
            }

            added |= TryAddApprovalsFromWorkforce(context, role, live, existing);
            added |= TryAddHelpRead(context, role, existing);
        }

        if (added)
            await context.SaveChangesAsync(cancellationToken);
    }

    private static bool TryAddApprovalsFromWorkforce(
        AppDbContext context,
        SecurityRole role,
        List<Permission> live,
        HashSet<(string Module, string Action, string Scope)> existing)
    {
        var added = false;
        var workforceReads = live
            .Where(p => (p.Module == "Leave" || p.Module == "Attendance") && p.Action == "Read")
            .ToList();
        var workforceUpdates = live
            .Where(p => (p.Module == "Leave" || p.Module == "Attendance") && p.Action == "Update")
            .ToList();

        var readScope = HighestScope(workforceReads.Select(p => p.Scope));
        if (!existing.Any(p => p.Module == "Approvals" && p.Action == "Read")
            && (readScope is "Team" or "All" || string.Equals(role.Code, "SUPERVISOR", StringComparison.OrdinalIgnoreCase)))
        {
            var scope = readScope is "Team" or "All" ? readScope : "Team";
            added |= AddIfMissing(context, role, existing, "Approvals", "Read", scope);
        }

        var updateScope = HighestScope(workforceUpdates.Select(p => p.Scope));
        if (!existing.Any(p => p.Module == "Approvals" && p.Action == "Update")
            && (updateScope is "Team" or "All" || string.Equals(role.Code, "SUPERVISOR", StringComparison.OrdinalIgnoreCase)))
        {
            var scope = updateScope is "Team" or "All" ? updateScope : "Team";
            added |= AddIfMissing(context, role, existing, "Approvals", "Update", scope);
        }

        return added;
    }

    private static bool TryAddHelpRead(
        AppDbContext context,
        SecurityRole role,
        HashSet<(string Module, string Action, string Scope)> existing)
    {
        if (existing.Any(p => p.Module == "Help" && p.Action == "Read"))
            return false;
        var scope = string.Equals(role.Code, "EMPLOYEE", StringComparison.OrdinalIgnoreCase) ? "Own" : "All";
        return AddIfMissing(context, role, existing, "Help", "Read", scope);
    }

    private static bool AddIfMissing(
        AppDbContext context,
        SecurityRole role,
        HashSet<(string Module, string Action, string Scope)> existing,
        string module,
        string action,
        string scope)
    {
        var key = (module, action, scope);
        if (existing.Contains(key)) return false;
        context.Permissions.Add(new Permission
        {
            RoleId = role.Id,
            Module = module,
            Action = action,
            Scope = scope,
        });
        existing.Add(key);
        return true;
    }

    private static string? HighestScope(IEnumerable<string?> scopes)
    {
        var list = scopes.Select(s => string.IsNullOrWhiteSpace(s) ? "Own" : s).ToList();
        if (list.Count == 0) return null;
        if (list.Contains("All", StringComparer.OrdinalIgnoreCase)) return "All";
        if (list.Contains("Team", StringComparer.OrdinalIgnoreCase)) return "Team";
        return "Own";
    }
}
