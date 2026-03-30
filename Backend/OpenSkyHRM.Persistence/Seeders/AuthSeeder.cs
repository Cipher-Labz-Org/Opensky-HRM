using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class AuthSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        await SeedRolesAndPermissions(context);
        await SeedDefaultAdminUser(context);
    }

    private static async Task SeedRolesAndPermissions(AppDbContext context)
    {
        if (await context.SecurityRoles.AnyAsync())
            return;

        var allModules = new[] { "Dashboard", "People", "Leave", "Attendance", "Payroll", "Performance", "Learning", "OrgStructure", "Analytics", "Settings", "Administration" };
        var allActions = new[] { "Create", "Read", "Update", "Delete" };
        var allScopes = new[] { "All" };

        var admin = new SecurityRole
        {
            Name = "Admin",
            Code = "ADMIN",
            Description = "Full system access",
            IsSystemRole = true
        };
        foreach (var module in allModules)
            foreach (var action in allActions)
                admin.Permissions.Add(new Permission { Module = module, Action = action, Scope = "All" });

        var hrManager = new SecurityRole
        {
            Name = "HR Manager",
            Code = "HR_MANAGER",
            Description = "Manage people, leave, settings, and administration",
            IsSystemRole = true
        };
        var hrModules = new[] { "Dashboard", "People", "Leave", "Attendance", "Payroll", "Settings", "Administration", "OrgStructure", "Analytics", "Learning" };
        foreach (var module in hrModules)
            foreach (var action in allActions)
                hrManager.Permissions.Add(new Permission { Module = module, Action = action, Scope = "All" });

        var supervisor = new SecurityRole
        {
            Name = "Supervisor",
            Code = "SUPERVISOR",
            Description = "View team, approve leave",
            IsSystemRole = true
        };
        supervisor.Permissions.Add(new Permission { Module = "Dashboard", Action = "Read", Scope = "All" });
        supervisor.Permissions.Add(new Permission { Module = "People", Action = "Read", Scope = "Team" });
        supervisor.Permissions.Add(new Permission { Module = "Leave", Action = "Read", Scope = "Team" });
        supervisor.Permissions.Add(new Permission { Module = "Leave", Action = "Update", Scope = "Team" });

        var employee = new SecurityRole
        {
            Name = "Employee",
            Code = "EMPLOYEE",
            Description = "Self-service access",
            IsSystemRole = true
        };
        employee.Permissions.Add(new Permission { Module = "Dashboard", Action = "Read", Scope = "Own" });
        employee.Permissions.Add(new Permission { Module = "People", Action = "Read", Scope = "Own" });
        employee.Permissions.Add(new Permission { Module = "Leave", Action = "Create", Scope = "Own" });
        employee.Permissions.Add(new Permission { Module = "Leave", Action = "Read", Scope = "Own" });

        context.SecurityRoles.AddRange(admin, hrManager, supervisor, employee);
        await context.SaveChangesAsync();
    }

    private static async Task SeedDefaultAdminUser(AppDbContext context)
    {
        var adminRole = await context.SecurityRoles.FirstOrDefaultAsync(r => r.Code == "ADMIN");
        if (adminRole == null) return;

        const string defaultAdminPassword = "Admin@123";
        var adminUser = await context.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Username == "admin");

        if (adminUser != null)
        {
            // Ensure existing admin has the known default password (for dev/demo)
            adminUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(defaultAdminPassword);
            adminUser.IsActive = true;
            await context.SaveChangesAsync();
            return;
        }

        if (await context.Users.AnyAsync())
            return;

        var newAdminUser = new User
        {
            Username = "admin",
            Email = "admin@openskyhrm.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(defaultAdminPassword),
            IsActive = true
        };

        newAdminUser.UserRoles.Add(new UserRole { RoleId = adminRole.Id });

        context.Users.Add(newAdminUser);
        await context.SaveChangesAsync();
    }
}
