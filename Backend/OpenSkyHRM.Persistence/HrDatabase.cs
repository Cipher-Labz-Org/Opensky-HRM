using Microsoft.Extensions.Configuration;

namespace OpenSkyHRM.Persistence;

/// <summary>
/// PostgreSQL schema that holds the HR tables. Standalone customer databases keep their data in
/// "public"; only the shared ERP database (Janasetha) sets <c>Database:Schema</c> to "HR".
/// Changing this on an existing deployment points the API at a different, empty set of tables.
/// </summary>
public static class HrDatabase
{
    public const string DefaultSchema = "public";
    public const string MigrationsHistoryTable = "__EFMigrationsHistory";

    public static string Schema { get; private set; } = DefaultSchema;

    public static bool UsesCustomSchema =>
        !string.Equals(Schema, DefaultSchema, StringComparison.Ordinal);

    public static void Configure(IConfiguration configuration)
    {
        var configured = configuration["Database:Schema"]?.Trim();
        Schema = string.IsNullOrEmpty(configured) ? DefaultSchema : configured;
    }

    /// <summary>
    /// Existing migrations create tables without a schema name, so a custom schema must be the session search path.
    /// </summary>
    public static string? WithSearchPath(string? connectionString)
    {
        if (!UsesCustomSchema || string.IsNullOrWhiteSpace(connectionString))
            return connectionString;

        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        builder.SearchPath = "\"" + Schema + "\"";
        return builder.ConnectionString;
    }
}
