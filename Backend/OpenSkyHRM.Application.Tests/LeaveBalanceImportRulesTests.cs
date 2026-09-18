using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class LeaveBalanceImportRulesTests
{
    private sealed record TypeRow(string Name, string Code, bool IsActive);

    private static readonly TypeRow[] Catalog =
    [
        new("Annual Leave", "LT-ANN", true),
        new("Casual Leave", "LT-CAS", true),
        new("Compensatory Off", "LT-COFF", true),
        new("Freelances Special Grant", "LT-FSG", true),
    ];

    private static TypeRow? Resolve(string excelName) =>
        LeaveBalanceImportRules.ResolveLeaveType(
            Catalog,
            excelName,
            t => t.Name,
            t => t.Code,
            t => t.IsActive);

    [Theory]
    [InlineData("Compensatory off", "Compensatory Off")]
    [InlineData("Compensatory Off", "Compensatory Off")]
    [InlineData("comp off", "Compensatory Off")]
    [InlineData("C-Off", "Compensatory Off")]
    [InlineData("Freelancer Special Grant", "Freelances Special Grant")]
    [InlineData("Freelance Special Grant", "Freelances Special Grant")]
    [InlineData("Freelances Special Grant", "Freelances Special Grant")]
    [InlineData("Annual", "Annual Leave")]
    [InlineData("Casual Leave", "Casual Leave")]
    [InlineData("LT-COFF", "Compensatory Off")]
    public void ResolveLeaveType_MatchesExcelAliases(string excelName, string expectedCatalogName)
    {
        var hit = Resolve(excelName);
        Assert.NotNull(hit);
        Assert.Equal(expectedCatalogName, hit!.Name);
    }

    [Theory]
    [InlineData("Compensatory Off", "LT-COFF", true)]
    [InlineData("Freelances Special Grant", "LT-FSG", true)]
    [InlineData("Annual Leave", "LT-ANN", false)]
    [InlineData("Casual Leave", "LT-CAS", false)]
    public void IsNonExpiringGrantType_ClassifiesGrantStock(string name, string code, bool expected)
    {
        Assert.Equal(expected, LeaveBalanceImportRules.IsNonExpiringGrantType(name, code));
    }

    [Fact]
    public void MapImportedStock_ConvertsGrantListedAsCarryForward()
    {
        var mapped = LeaveBalanceImportRules.MapImportedStock(0, 17.5m, leaveTypeHasEntitlementRule: false);
        Assert.Equal(17.5m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
        Assert.True(mapped.Converted);
    }

    [Fact]
    public void MapImportedStock_ConvertsGrantEvenWhenEntitlementRuleExists()
    {
        var mapped = LeaveBalanceImportRules.MapImportedStock(
            0, 1m, leaveTypeHasEntitlementRule: true, isNonExpiringGrant: true);
        Assert.Equal(1m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
        Assert.True(mapped.Converted);
    }

    [Fact]
    public void MapImportedStock_KeepsCarryForwardWhenEntitlementRuleExists()
    {
        var mapped = LeaveBalanceImportRules.MapImportedStock(0, 11.5m, leaveTypeHasEntitlementRule: true);
        Assert.Equal(0, mapped.Entitled);
        Assert.Equal(11.5m, mapped.CarriedForward);
        Assert.False(mapped.Converted);
    }

    [Fact]
    public void MapStoredGrantForDisplay_RestoresForfeitedCarryAsRemaining()
    {
        var mapped = LeaveBalanceImportRules.MapStoredGrantForDisplay(
            entitled: 0, used: 3.5m, carriedForward: 0, broughtForwardDays: 17.5m);
        Assert.Equal(17.5m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
        Assert.Equal(14m, mapped.Remaining);
    }

    [Fact]
    public void EmployeeCodesMatch_IgnoresLeadingZeros()
    {
        Assert.True(LeaveBalanceImportRules.EmployeeCodesMatch("013", "13"));
        Assert.True(LeaveBalanceImportRules.EmployeeCodesMatch("1127", "01127"));
        Assert.False(LeaveBalanceImportRules.EmployeeCodesMatch("NXW0001", "13"));
    }

    [Fact]
    public void MapStoredGrantForDisplay_DoesNotDoubleCountConvertedEntitled()
    {
        var mapped = LeaveBalanceImportRules.MapStoredGrantForDisplay(
            entitled: 17.5m, used: 3.5m, carriedForward: 0, broughtForwardDays: 17.5m);
        Assert.Equal(17.5m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
        Assert.Equal(14m, mapped.Remaining);
    }
}
