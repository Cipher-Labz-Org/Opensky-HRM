namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Ensures system employment types (incl. Freelancer) exist when migrations or seeders did not run.
/// Job Details reads <c>/api/organization/employment-statuses</c> from this catalog.
/// </summary>
public static class EmploymentCatalogSchemaRepair
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
                INSERT INTO "EmploymentStatusTypes" ("Id","Name","Code","IsActive","IsSystem","SortOrder","CreatedAt","IsDeleted")
                SELECT gen_random_uuid(), v."Name", v."Code", true, true, v."Ord", now(), false
                FROM (VALUES
                    ('Full-Time Permanent', 'FullTimePermanent', 1),
                    ('Full-Time Probation', 'FullTimeProbation', 2),
                    ('Full-Time Contract', 'FullTimeContract', 3),
                    ('Full-Time Internship', 'FullTimeInternship', 4),
                    ('Part-Time Permanent', 'PartTimePermanent', 5),
                    ('Part-Time Contract', 'PartTimeContract', 6),
                    ('Part-Time Internship', 'PartTimeInternship', 7),
                    ('Freelancer', 'Freelance', 8)
                ) AS v("Name","Code","Ord")
                WHERE NOT EXISTS (
                    SELECT 1 FROM "EmploymentStatusTypes" e
                    WHERE e."IsDeleted" = false
                      AND (e."Code" = v."Code" OR e."Code" ILIKE v."Code")
                );

                UPDATE "EmploymentStatusTypes"
                SET "IsDeleted" = false, "IsActive" = true, "IsSystem" = true,
                    "Name" = 'Freelancer', "Code" = 'Freelance', "SortOrder" = 8
                WHERE "IsDeleted" = true
                  AND ("Code" ILIKE 'Freelance' OR "Code" ILIKE 'Freelancer' OR "Name" ILIKE 'Freelancer%');
                """;
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Employment catalog repair skipped: {ex.Message}");
        }
    }
}
