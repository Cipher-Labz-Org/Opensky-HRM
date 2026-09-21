namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Makes Candidates.RequisitionId optional for the talent pool when the
/// SQL-only migration did not apply (MigrateAsync is swallowed on failure).
/// </summary>
public static class RecruitmentSchemaRepair
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
                ALTER TABLE "Candidates" ALTER COLUMN "RequisitionId" DROP NOT NULL;

                ALTER TABLE "Candidates" DROP CONSTRAINT IF EXISTS "FK_Candidates_Requisitions_RequisitionId";

                ALTER TABLE "Candidates"
                    ADD CONSTRAINT "FK_Candidates_Requisitions_RequisitionId"
                    FOREIGN KEY ("RequisitionId") REFERENCES "Requisitions" ("Id") ON DELETE SET NULL;
                """;
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Recruitment schema repair skipped: {ex.Message}");
        }
    }
}
