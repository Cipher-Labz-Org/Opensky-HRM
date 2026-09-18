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
    public void ComputeRemaining_DoesNotDoubleCountClosingBalance()
    {
        Assert.Equal(11.5m, LeaveBalanceImportRules.ComputeRemaining(14, 2.5m, 11.5m));
        Assert.Equal(0.5m, LeaveBalanceImportRules.ComputeRemaining(7, 6.5m, 0.5m));
        Assert.Equal(2m, LeaveBalanceImportRules.ComputeRemaining(0, 0, 2m));
        Assert.Equal(18.5m, LeaveBalanceImportRules.ComputeRemaining(21, 2.5m, 18.5m));
        Assert.Equal(21m, LeaveBalanceImportRules.ComputeRemaining(21, 0, 21m));
        Assert.Equal(21m, LeaveBalanceImportRules.ComputeRemaining(21, 0, 0));
        Assert.Equal(17m, LeaveBalanceImportRules.ComputeRemaining(14, 2m, 5m));
        Assert.Equal(1m, LeaveBalanceImportRules.ComputeRemaining(1, 0, 0));
    }

    [Fact]
    public void MapImportedStock_ZerosCarryWhenItIsClosingRemaining()
    {
        var mapped = LeaveBalanceImportRules.MapImportedStock(
            14, 11.5m, leaveTypeHasEntitlementRule: true, used: 2.5m);
        Assert.Equal(14m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
        Assert.Equal(11.5m, LeaveBalanceImportRules.ComputeRemaining(mapped.Entitled, 2.5m, mapped.CarriedForward));

        var casual = LeaveBalanceImportRules.MapImportedStock(
            7, 0.5m, leaveTypeHasEntitlementRule: true, used: 6.5m);
        Assert.Equal(7m, casual.Entitled);
        Assert.Equal(0, casual.CarriedForward);
        Assert.Equal(0.5m, LeaveBalanceImportRules.ComputeRemaining(casual.Entitled, 6.5m, casual.CarriedForward));

        var fsg = LeaveBalanceImportRules.MapImportedStock(
            21, 18.5m, leaveTypeHasEntitlementRule: false, isNonExpiringGrant: true, used: 2.5m);
        Assert.Equal(21m, fsg.Entitled);
        Assert.Equal(0, fsg.CarriedForward);
        Assert.Equal(18.5m, LeaveBalanceImportRules.ComputeRemaining(fsg.Entitled, 2.5m, fsg.CarriedForward));

        var coff = LeaveBalanceImportRules.MapImportedStock(
            0, 2m, leaveTypeHasEntitlementRule: true, isNonExpiringGrant: true, used: 0);
        Assert.Equal(2m, coff.Entitled);
        Assert.Equal(0, coff.CarriedForward);
        Assert.Equal(2m, LeaveBalanceImportRules.ComputeRemaining(coff.Entitled, 0, coff.CarriedForward));
    }

    [Fact]
    public void MapImportedStock_EntitledOnlyRowIsKept()
    {
        var mapped = LeaveBalanceImportRules.MapImportedStock(
            21, 0, leaveTypeHasEntitlementRule: true);
        Assert.Equal(21m, mapped.Entitled);
        Assert.Equal(0, mapped.CarriedForward);
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

    [Fact]
    public void CollapseDuplicateLeaveTypeRows_KeepsTheStockedLine()
    {
        var emptyId = Guid.NewGuid();
        var coffId = Guid.NewGuid();
        var rows = new[]
        {
            (LeaveTypeId: coffId, Entitled: 0m, Used: 0m, CarriedForward: 0m, Remaining: 0m),
            (LeaveTypeId: coffId, Entitled: 1m, Used: 0m, CarriedForward: 0m, Remaining: 1m),
            (LeaveTypeId: emptyId, Entitled: 14m, Used: 2m, CarriedForward: 0m, Remaining: 12m),
        };

        var collapsed = LeaveBalanceImportRules.CollapseDuplicateLeaveTypeRows(
            rows, r => r.LeaveTypeId, r => r.Entitled, r => r.Used, r => r.CarriedForward, r => r.Remaining);

        Assert.Equal(2, collapsed.Count);
        Assert.Equal(1m, collapsed.Single(r => r.LeaveTypeId == coffId).Remaining);
        Assert.Equal(12m, collapsed.Single(r => r.LeaveTypeId == emptyId).Remaining);
    }
}
