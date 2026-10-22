using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace OpenSkyHRM.Persistence;

/// <summary>EF Core migrations / design-time tools (no DI).</summary>
public sealed class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var persistenceRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
        var apiDir = Path.GetFullPath(Path.Combine(persistenceRoot, "..", "OpenSkyHRM.Api"));

        var config = new ConfigurationBuilder()
            .SetBasePath(apiDir)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var conn = HrDatabase.WithSearchPath(config.GetConnectionString("DefaultConnection")
                   ?? "Host=localhost;Port=5432;Database=Janasetha;Username=postgres;Password=postgres");

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(conn, npgsql => npgsql
                .MigrationsAssembly(typeof(AppDbContext).Assembly.FullName)
                .MigrationsHistoryTable(HrDatabase.MigrationsHistoryTable, HrDatabase.Schema))
            .Options;

        return new AppDbContext(options, new BusinessClock(config));
    }
}
