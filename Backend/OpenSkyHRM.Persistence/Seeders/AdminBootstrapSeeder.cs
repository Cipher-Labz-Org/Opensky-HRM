using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Ensures there is at least one usable ADMIN account after a transactional purge.
/// This is intentionally minimal (no demo org/employees).
/// </summary>
public static class AdminBootstrapSeeder
{
    public static async Task EnsureAsync(
        AppDbContext context,
        string adminUsername = "admin",
        string adminEmail = "admin@openskyhrm.com",
        string adminPassword = "Admin@123",
        bool forceResetPassword = false,
        CancellationToken cancellationToken = default)
    {
        // Ensure ADMIN role exists (and has full permissions).
        var adminRole = await context.SecurityRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Code == "ADMIN", cancellationToken);

        if (adminRole == null)
        {
            adminRole = new SecurityRole
            {
                Name = "Admin",
                Code = "ADMIN",
                Description = "Full system access",
                IsSystemRole = true
            };
            context.SecurityRoles.Add(adminRole);
            await context.SaveChangesAsync(cancellationToken);
        }

        // If permissions were purged, restore the common full-access matrix.
        if (adminRole.Permissions.Count == 0)
        {
            var allModules = new[]
            {
                "Dashboard", "People", "Leave", "Attendance", "Payroll", "Performance", "Learning",
                "OrgStructure", "Analytics", "Settings", "Administration", "Billing"
            };
            var allActions = new[] { "Create", "Read", "Update", "Delete" };

            foreach (var module in allModules)
                foreach (var action in allActions)
                    adminRole.Permissions.Add(new Permission { Module = module, Action = action, Scope = "All", RoleId = adminRole.Id });

            await context.SaveChangesAsync(cancellationToken);
        }

        // Ensure at least one active admin user exists.
        var anyAdminUser = await context.UserRoles
            .Include(ur => ur.User)
            .AnyAsync(ur => ur.RoleId == adminRole.Id && !ur.User.IsDeleted, cancellationToken);

        if (anyAdminUser && !forceResetPassword)
            return;

        var user = await context.Users
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Username == adminUsername, cancellationToken);

        if (user == null)
        {
            user = new User
            {
                Username = adminUsername,
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                IsActive = true
            };
            user.UserRoles.Add(new UserRole { RoleId = adminRole.Id });
            context.Users.Add(user);
        }
        else
        {
            user.IsActive = true;
            // When forced (dev recovery), reset password to the provided bootstrap password.
            if (forceResetPassword)
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
            if (!user.UserRoles.Any(ur => ur.RoleId == adminRole.Id))
                user.UserRoles.Add(new UserRole { RoleId = adminRole.Id });
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}

