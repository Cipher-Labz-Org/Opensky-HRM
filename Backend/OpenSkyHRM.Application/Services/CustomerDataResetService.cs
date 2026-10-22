using System.Data;
using System.Data.Common;
using System.Linq;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Resetting;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

namespace OpenSkyHRM.Application.Services;

public class CustomerDataResetService : ICustomerDataResetService
{
    private const string ConfirmPhraseConfigPath = "CustomerReset:ConfirmPhrase";
    private const string DefaultConfirmPhrase = "ERASE CUSTOMER DATA";

    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public CustomerDataResetService(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    public async Task<CustomerResetDryRunResult> DryRunAsync(
        bool includeHangfire,
        CancellationToken cancellationToken)
    {
        var counts = new List<CustomerResetDryRunTableCount>(CustomerTransactionPurgeMatrix.TransactionTables.Length);

        // Counts can be expensive; keep it simple and explicit for safety/visibility.
        await using var conn = _db.Database.GetDbConnection();
        await conn.OpenAsync(cancellationToken);
        var existingTables = await GetExistingTransactionTablesAsync(conn, tx: null, cancellationToken);

        foreach (var table in existingTables)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandType = CommandType.Text;
            cmd.CommandText = $"SELECT COUNT(*)::bigint FROM \"{table}\";";
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            var count = result is long l ? l : Convert.ToInt64(result);
            counts.Add(new CustomerResetDryRunTableCount(table, count));
        }

        return new CustomerResetDryRunResult(counts, includeHangfire);
    }

    public async Task<CustomerResetExecuteResult> ExecuteAsync(
        string providedConfirmPhrase,
        bool allowInProduction,
        bool includeHangfire,
        IReadOnlyList<string>? selectedTables,
        CancellationToken cancellationToken)
    {
        var requiredPhrase = _configuration[ConfirmPhraseConfigPath];
        if (string.IsNullOrWhiteSpace(requiredPhrase))
            requiredPhrase = DefaultConfirmPhrase;

        if (string.IsNullOrWhiteSpace(providedConfirmPhrase))
            throw new InvalidOperationException(
                $"Missing confirmation phrase. Provide '{requiredPhrase}' to execute a reset.");

        if (!string.Equals(providedConfirmPhrase.Trim(), requiredPhrase.Trim(), StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Invalid confirmation phrase.");

        var envName = _configuration["ASPNETCORE_ENVIRONMENT"] ?? _configuration["DOTNET_ENVIRONMENT"];
        var isProduction = string.Equals(envName, "Production", StringComparison.OrdinalIgnoreCase);
        if (isProduction && !allowInProduction)
            throw new UnauthorizedAccessException("Reset is not allowed in production unless allowInProduction is explicitly set.");

        // Transactional purge + licensing baseline re-ensure.
        // Note: TRUNCATE is used for speed and to reset identity sequences.
        await _db.Database.OpenConnectionAsync(cancellationToken);
        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var conn = _db.Database.GetDbConnection();
            var dbTx = _db.Database.CurrentTransaction?.GetDbTransaction();
            var existingTables = await GetExistingTransactionTablesAsync(conn, dbTx, cancellationToken);
            var targetTables = selectedTables is { Count: > 0 }
                ? existingTables
                    .Where(t => selectedTables.Contains(t, StringComparer.Ordinal))
                    .ToList()
                : existingTables;

            if (targetTables.Count == 0)
                throw new InvalidOperationException("No valid tables selected for reset.");

            if (targetTables.Count > 0)
            {
                // Keep system users (including the bootstrap admin). Postgres does not allow TRUNCATE on a referenced
                // table when a foreign key exists (even if values are NULL). Users has an FK to Employees.
                // Strategy:
                // - Truncate all transactional tables *except* Employees
                // - Then DELETE Employees (safe after child tables are cleared)
                if (targetTables.Contains("Employees"))
                {
                    await _db.Database.ExecuteSqlRawAsync("UPDATE \"Users\" SET \"EmployeeId\" = NULL WHERE \"EmployeeId\" IS NOT NULL;", cancellationToken);
                }

                var toTruncate = targetTables
                    .Where(t => !string.Equals(t, "Employees", StringComparison.Ordinal))
                    .Where(t => !string.Equals(t, "Departments", StringComparison.Ordinal))
                    .ToArray();

                if (toTruncate.Length > 0)
                {
                    var truncateSql = CustomerDataResetSqlBuilder.BuildTransactionTruncateSql(toTruncate, cascade: true);
                    await _db.Database.ExecuteSqlRawAsync(truncateSql, cancellationToken);
                }

                // Employees uses GUID IDs (no identity), so DELETE is fine.
                if (targetTables.Contains("Employees"))
                    await _db.Database.ExecuteSqlRawAsync("DELETE FROM \"Employees\";", cancellationToken);

                // Departments are referenced by employees/positions; clear after employee purge.
                if (targetTables.Contains("Departments"))
                {
                    await _db.Database.ExecuteSqlRawAsync(
                        "TRUNCATE TABLE \"Positions\" RESTART IDENTITY CASCADE;",
                        cancellationToken);
                    await _db.Database.ExecuteSqlRawAsync(
                        "TRUNCATE TABLE \"Departments\" RESTART IDENTITY CASCADE;",
                        cancellationToken);
                }

                // Keep only the primary system admin user (username = 'admin').
                // Remove other user-role links first, then delete the users themselves.
                if (targetTables.Contains("Employees"))
                {
                    await _db.Database.ExecuteSqlRawAsync(@"
DELETE FROM ""UserRoles"" ur
USING ""Users"" u
WHERE ur.""UserId"" = u.""Id""
  AND lower(u.""Username"") <> 'admin';", cancellationToken);

                    await _db.Database.ExecuteSqlRawAsync(@"
DELETE FROM ""Users""
WHERE lower(""Username"") <> 'admin';", cancellationToken);
                }
            }

            if (includeHangfire)
            {
                await _db.Database.ExecuteSqlRawAsync(CustomerDataResetSqlBuilder.BuildHangfirePurgeSql(), cancellationToken);
            }

            // Ensure the baseline licensing catalog/entitlements exist after wiping operational data.
            await LicensingSeeder.EnsureAsync(_db, cancellationToken);

            // Ensure there is at least one usable admin account after a transactional purge.
            await AdminBootstrapSeeder.EnsureAsync(_db, cancellationToken: cancellationToken);

            await tx.CommitAsync(cancellationToken);
            return new CustomerResetExecuteResult(
                new CustomerResetDryRunResult(Array.Empty<CustomerResetDryRunTableCount>(), includeHangfire),
                includeHangfire);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
        finally
        {
            await _db.Database.CloseConnectionAsync();
        }
    }

    private static async Task<List<string>> GetExistingTransactionTablesAsync(
        DbConnection conn,
        DbTransaction? tx,
        CancellationToken cancellationToken)
    {
        var wanted = CustomerTransactionPurgeMatrix.TransactionTables.ToHashSet(StringComparer.Ordinal);
        var existing = new List<string>();

        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandType = CommandType.Text;
        cmd.CommandText = @"
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'HR'
  AND table_type = 'BASE TABLE';";

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var table = reader.GetString(0);
            if (wanted.Contains(table))
                existing.Add(table);
        }

        return existing;
    }
}

