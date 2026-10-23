using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Persistence.Auditing;

namespace OpenSkyHRM.Persistence;

public static class DependencyInjection
{
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        HrDatabase.Configure(configuration);
        services.AddSingleton<IBusinessClock, BusinessClock>();
        services.AddScoped<PeopleHubAuditSaveChangesInterceptor>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            options.UseNpgsql(
                HrDatabase.WithSearchPath(configuration.GetConnectionString("DefaultConnection")),
                npgsql => npgsql
                    .MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)
                    .MigrationsHistoryTable(HrDatabase.MigrationsHistoryTable, HrDatabase.Schema));
            options.AddInterceptors(sp.GetRequiredService<PeopleHubAuditSaveChangesInterceptor>());
        });

        return services;
    }
}
