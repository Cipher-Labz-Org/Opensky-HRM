using OpenSkyHRM.Application.Resetting;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class CustomerDataResetSqlBuilderTests
{
    [Fact]
    public void TransactionTruncateSql_Quotes_And_Separates_Tables()
    {
        var sql = CustomerDataResetSqlBuilder.BuildTransactionTruncateSql(new[] { "Employees", "LeaveRequests" });
        Assert.Contains("TRUNCATE TABLE \"Employees\", \"LeaveRequests\" RESTART IDENTITY;", sql);
    }

    [Fact]
    public void TransactionTruncateSql_WithCascade_ForPostgresForeignKeys()
    {
        var sql = CustomerDataResetSqlBuilder.BuildTransactionTruncateSql(
            new[] { "PayStatements", "PayrollBatches" },
            cascade: true);
        Assert.Contains("TRUNCATE TABLE \"PayStatements\", \"PayrollBatches\" RESTART IDENTITY CASCADE;", sql);
    }

    [Fact]
    public void PurgeMatrix_DoesNotInclude_LicensingOrUsers_MasterData()
    {
        var tables = CustomerTransactionPurgeMatrix.TransactionTables;

        Assert.DoesNotContain("LicensedModules", tables);
        Assert.DoesNotContain("InstanceSubscriptions", tables);
        Assert.DoesNotContain("InstanceModuleEntitlements", tables);
        Assert.DoesNotContain("Users", tables);
        Assert.DoesNotContain("SecurityRoles", tables);
    }

    [Fact]
    public void HangfirePurgeSql_TargetsHangfireSchemas()
    {
        var sql = CustomerDataResetSqlBuilder.BuildHangfirePurgeSql();
        Assert.Contains("ARRAY['Hangfire','hangfire']", sql.Replace(" ", ""));
        Assert.Contains("information_schema.tables", sql);
        Assert.Contains("TRUNCATE TABLE", sql);
    }
}

