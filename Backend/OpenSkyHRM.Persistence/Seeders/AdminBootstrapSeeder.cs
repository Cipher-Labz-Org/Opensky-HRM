using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Seeds the default system administrator into <c>Users</c> (all environments).
/// Credentials are fixed here — not read from appsettings.
/// </summary>
public static class AdminBootstrapSeeder
{
    public const string DefaultAdminUsername = "Admin";
    public const string DefaultAdminEmail = "admin@openskyhrm.com";
    public const string DefaultAdminPassword = "Admin@123";

    public static async Task EnsureAsync(
        AppDbContext context,
        bool forceResetPassword = false,
        CancellationToken cancellationToken = default)
    {
        await EnsureAsync(
            context,
            DefaultAdminUsername,
            DefaultAdminEmail,
            DefaultAdminPassword,
            forceResetPassword,
            cancellationToken);
    }

    public static async Task EnsureAsync(
        AppDbContext context,
        string adminUsername,
        string adminEmail,
        string adminPassword,
        bool forceResetPassword = false,
        CancellationToken cancellationToken = default)
    {
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

        var usernameLower = adminUsername.Trim().ToLowerInvariant();
        var user = await context.Users
            .IgnoreQueryFilters()
            .Include(u => u.UserRoles)
            .FirstOrDefaultAsync(u => u.Username.ToLower() == usernameLower, cancellationToken);

        if (user == null)
        {
            user = new User
            {
                Username = adminUsername,
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                IsActive = true,
                MustChangePassword = false
            };
            user.UserRoles.Add(new UserRole { RoleId = adminRole.Id });
            context.Users.Add(user);
        }
        else
        {
            user.Username = adminUsername;
            user.IsDeleted = false;
            user.IsActive = true;
            if (string.IsNullOrWhiteSpace(user.Email))
                user.Email = adminEmail;

            var needsPassword =
                forceResetPassword ||
                string.IsNullOrWhiteSpace(user.PasswordHash);
            if (needsPassword)
                user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);

            if (!user.UserRoles.Any(ur => ur.RoleId == adminRole.Id && !ur.IsDeleted))
                user.UserRoles.Add(new UserRole { RoleId = adminRole.Id });
        }

        await context.SaveChangesAsync(cancellationToken);
        Console.WriteLine($"AdminBootstrapSeeder: ensured user '{adminUsername}' (Id: {user.Id}).");
    }
}
