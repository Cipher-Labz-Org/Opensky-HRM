using Microsoft.Extensions.Configuration;

namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Fixes partial Hangfire.PostgreSql installs (e.g. 42701: column "updatecount" on hangfire.lock already exists)
/// so the API can start and background jobs can run.
/// </summary>
public static class HangfireSchemaRepair
{
    /// <summary>Matches Hangfire.PostgreSql 1.21.x; bump when upgrading that package.</summary>
    private const int ExpectedHangfireSchemaVersion = 9;

    public static async Task EnsureHealthySchemaAsync(string? connectionString, IConfiguration configuration)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var resetOnStartup = configuration.GetValue<bool>("Hangfire:ResetSchemaOnStartup");
        var repairOnStartup = configuration.GetValue("Hangfire:RepairCorruptedSchemaOnStartup", true);

        if (!resetOnStartup && !repairOnStartup)
            return;

        try
        {
            await using var conn = new Npgsql.NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            if (resetOnStartup)
            {
                await DropHangfireSchemasAsync(conn);
                Console.WriteLine("INFO: Hangfire schema reset (Hangfire:ResetSchemaOnStartup=true).");
                return;
            }

            if (!await HangfireSchemaExistsAsync(conn))
                return;

            if (await ShouldDropCorruptedSchemaAsync(conn))
            {
                await DropHangfireSchemasAsync(conn);
                Console.WriteLine(
                    "INFO: Dropped corrupted Hangfire schema (partial install detected). Hangfire will recreate tables on startup.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Hangfire schema repair skipped: {ex.Message}");
        }
    }

    private static async Task<bool> HangfireSchemaExistsAsync(Npgsql.NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.schemata
                WHERE schema_name IN ('hangfire', 'Hangfire')
            );
            """;
        return (bool)(await cmd.ExecuteScalarAsync() ?? false);
    }

    private static async Task<bool> ShouldDropCorruptedSchemaAsync(Npgsql.NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT
                EXISTS (
                    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'hangfire'
                ) AS has_hangfire_schema,
                EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'hangfire' AND table_name = 'schema'
                ) AS has_schema_table,
                EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'hangfire' AND table_name = 'lock'
                ) AS has_lock_table,
                EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'hangfire'
                       AND table_name = 'lock'
                       AND column_name = 'updatecount'
                ) AS lock_has_updatecount,
                EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'hangfire' AND table_name = 'job'
                ) AS has_job_table;
            """;
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            return false;

        var hasHangfireSchema = reader.GetBoolean(0);
        var hasSchemaTable = reader.GetBoolean(1);
        var hasLockTable = reader.GetBoolean(2);
        var lockHasUpdateCount = reader.GetBoolean(3);
        var hasJobTable = reader.GetBoolean(4);

        if (!hasHangfireSchema)
            return false;

        // Partial install: objects exist but version metadata table is missing.
        if (!hasSchemaTable && (hasLockTable || hasJobTable))
            return true;

        // Partial install: lock table exists without the rest of the schema.
        if (hasLockTable && !hasSchemaTable)
            return true;

        // Stuck upgrade: installer tries to ADD updatecount but column already exists (42701).
        if (lockHasUpdateCount && !hasSchemaTable)
            return true;

        if (lockHasUpdateCount && hasSchemaTable)
        {
            var maxVersion = await GetMaxSchemaVersionAsync(conn);
            if (maxVersion == 0)
                return true;

            // Stuck mid-upgrade: column added but schema version row not advanced (42701 on restart).
            if (maxVersion < ExpectedHangfireSchemaVersion)
                return true;

            // lock + updatecount present but core job queue table never created.
            if (!hasJobTable)
                return true;
        }

        return false;
    }

    private static async Task<int> GetMaxSchemaVersionAsync(Npgsql.NpgsqlConnection conn)
    {
        try
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COALESCE(MAX(version), 0) FROM hangfire.schema;";
            var result = await cmd.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }
        catch
        {
            return 0;
        }
    }

    private static async Task DropHangfireSchemasAsync(Npgsql.NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            DROP SCHEMA IF EXISTS hangfire CASCADE;
            DROP SCHEMA IF EXISTS "Hangfire" CASCADE;
            """;
        await cmd.ExecuteNonQueryAsync();
    }
}
