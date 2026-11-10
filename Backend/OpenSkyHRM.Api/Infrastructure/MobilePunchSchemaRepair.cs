namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Adds mobile punch permission columns when a later migration fails before this change is applied.
/// </summary>
public static class MobilePunchSchemaRepair
{
    public static async Task EnsureCompatibleSchemaAsync(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        try
        {
            await using var conn = new Npgsql.NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                ALTER TABLE "BusinessUnits" ADD COLUMN IF NOT EXISTS "AllowMobilePunch" boolean NOT NULL DEFAULT FALSE;
                ALTER TABLE "Locations" ADD COLUMN IF NOT EXISTS "AllowMobilePunch" boolean NOT NULL DEFAULT FALSE;
                """;
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Mobile punch schema repair skipped: {ex.Message}");
        }
    }
}
