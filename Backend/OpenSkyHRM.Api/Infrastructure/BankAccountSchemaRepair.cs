namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Removes legacy <c>BankAccounts.Amount</c> when older DBs were not fully migrated.
/// Inserts failed with 23502/null in Amount after the column was removed from the app model.
/// </summary>
public static class BankAccountSchemaRepair
{
    public static async Task EnsureCompatibleSchemaAsync(string? connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        try
        {
            await using var conn = new Npgsql.NpgsqlConnection(connectionString);
            await conn.OpenAsync();

            await using var check = conn.CreateCommand();
            check.CommandText = """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'BankAccounts'
                  AND column_name = 'Amount'
                LIMIT 1;
                """;
            var stillHasAmount = await check.ExecuteScalarAsync() is not null;
            if (!stillHasAmount)
                return;

            await using var drop = conn.CreateCommand();
            drop.CommandText = """ALTER TABLE "BankAccounts" DROP COLUMN IF EXISTS "Amount";""";
            await drop.ExecuteNonQueryAsync();
            Console.WriteLine("INFO: Removed legacy BankAccounts.Amount column.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: BankAccounts schema repair skipped: {ex.Message}");
        }
    }
}
