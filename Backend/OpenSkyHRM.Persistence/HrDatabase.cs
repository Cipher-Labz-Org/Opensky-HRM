namespace OpenSkyHRM.Persistence;

/// <summary>
/// HR tables live in one PostgreSQL schema inside the shared ERP database,
/// the same way Sales, Identity, and Inventory each own a schema in Janasetha.
/// </summary>
public static class HrDatabase
{
    public const string Schema = "HR";
    public const string MigrationsHistoryTable = "__EFMigrationsHistory";

    /// <summary>
    /// Existing migrations create tables without a schema name, so the session search path must be "HR".
    /// </summary>
    public static string WithSearchPath(string? connectionString)
    {
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        builder.SearchPath = "\"" + Schema + "\"";
        return builder.ConnectionString;
    }
}
