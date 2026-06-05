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
        await SecurityRolesSeeder.EnsureAsync(context);
    }

    private static async Task SeedDefaultAdminUser(AppDbContext context)
    {
        var adminRole = await context.SecurityRoles.FirstOrDefaultAsync(r => r.Code == "ADMIN");
        if (adminRole == null) return;

        await AdminBootstrapSeeder.EnsureAsync(context, forceResetPassword: true);
    }
}
