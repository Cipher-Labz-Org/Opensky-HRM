namespace OpenSkyHRM.Api.Infrastructure;

/// <summary>
/// Ensures <see cref="OpenSkyHRM.Domain.Entities.Employee.CompanyProfileKey"/> exists when
/// SQL-only migration <c>20261005120000_AddEmployeeCompanyProfileKey</c> did not run
/// (e.g. swallowed MigrateAsync).
/// </summary>
public static class EmployeeCompanyProfileSchemaRepair
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
                ALTER TABLE "Employees" ADD COLUMN IF NOT EXISTS "CompanyProfileKey" character varying(64) NOT NULL DEFAULT 'primary';
                UPDATE "Employees"
                SET "CompanyProfileKey" = 'primary'
                WHERE "CompanyProfileKey" IS NULL OR TRIM("CompanyProfileKey") = '';
                CREATE INDEX IF NOT EXISTS "IX_Employees_CompanyProfileKey" ON "Employees" ("CompanyProfileKey");
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20261005120000_AddEmployeeCompanyProfileKey', '8.0.30'
                WHERE NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20261005120000_AddEmployeeCompanyProfileKey'
                );

                CREATE TABLE IF NOT EXISTS "UserAssignedCompanyProfiles" (
                    "Id" uuid NOT NULL,
                    "UserId" uuid NOT NULL,
                    "CompanyProfileKey" character varying(64) NOT NULL,
                    "CreatedAt" timestamp without time zone NOT NULL DEFAULT NOW(),
                    "UpdatedAt" timestamp without time zone NULL,
                    "IsDeleted" boolean NOT NULL DEFAULT false,
                    "CreatedBy" text NULL,
                    "UpdatedBy" text NULL,
                    CONSTRAINT "PK_UserAssignedCompanyProfiles" PRIMARY KEY ("Id"),
                    CONSTRAINT "FK_UserAssignedCompanyProfiles_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserAssignedCompanyProfiles_UserId_CompanyProfileKey"
                    ON "UserAssignedCompanyProfiles" ("UserId", "CompanyProfileKey");
                INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
                SELECT '20261005180000_AddUserAssignedCompanyProfiles', '8.0.30'
                WHERE NOT EXISTS (
                    SELECT 1 FROM "__EFMigrationsHistory"
                    WHERE "MigrationId" = '20261005180000_AddUserAssignedCompanyProfiles'
                );
                """;
            await cmd.ExecuteNonQueryAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Employee CompanyProfileKey schema repair skipped: {ex.Message}");
        }
    }
}
