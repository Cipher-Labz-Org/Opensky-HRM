using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace OpenSkyHRM.Persistence.Seeders;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

        try
        {
            logger.LogInformation("Starting database seeding...");

            await AuthSeeder.SeedAsync(context);
            await OrganizationSeeder.SeedAsync(context);
            await LeaveSeeder.SeedAsync(context);
            await LeaveSeeder.EnsureCatalogLeaveTypesAsync(context);
            await DocumentTemplateSeeder.SeedAsync(context);
            await DocumentTemplateSeeder.EnsureLetterPackAsync(context);
            await TransactionalEmailTemplateSeeder.EnsureAsync(context);
            await PayrollSeeder.SeedAsync(context);
            await PayrollSeeder.SeedDemoDataAsync(context);
            await EmployeeLifecycleTemplateSeeder.EnsureAsync(context);

            await context.SaveChangesAsync();
            logger.LogInformation("Database seeding completed.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while seeding the database.");
            throw;
        }
    }
}
