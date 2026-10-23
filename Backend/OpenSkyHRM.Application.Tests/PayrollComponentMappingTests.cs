using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollComponentMappingTests
{
    [Fact]
    public void IsOtComponent_MatchesMappedCode()
    {
        Assert.True(PayrollComponentMapping.IsOtComponent("OT_EXTRA", "OT_EXTRA"));
        Assert.False(PayrollComponentMapping.IsOtComponent("OT", "OT_EXTRA"));
    }

    [Fact]
    public void IsNopayComponent_MatchesMappedCode()
    {
        Assert.True(PayrollComponentMapping.IsNopayComponent("NO_PAY", "NO_PAY"));
        Assert.False(PayrollComponentMapping.IsNopayComponent("NOPAY", "NO_PAY"));
    }

    [Fact]
    public void IsPoyaComponent_UsesMappedCodeOrLegacyDefault()
    {
        Assert.True(PayrollComponentMapping.IsPoyaComponent("POYA_PAY", null, "POYA_PAY"));
        Assert.True(PayrollComponentMapping.IsPoyaComponent("POYA", "Poya Day Pay", "POYA"));
        Assert.False(PayrollComponentMapping.IsPoyaComponent("POYA", null, "POYA_PAY"));
    }

    [Fact]
    public void IsBaseComponent_MatchesMappedAndBasicAliasesWhenDefault()
    {
        Assert.True(PayrollComponentMapping.IsBaseComponent("BASIC1", "BASIC"));
        Assert.True(PayrollComponentMapping.IsBaseComponent("PACKAGE", "PACKAGE"));
        Assert.False(PayrollComponentMapping.IsBaseComponent("BASIC", "PACKAGE"));
    }

    [Fact]
    public void IsWorkingHoursComponent_RequiresMappedCode()
    {
        Assert.False(PayrollComponentMapping.IsWorkingHoursComponent("HOURS", null));
        Assert.False(PayrollComponentMapping.IsWorkingHoursComponent("HOURS", ""));
        Assert.True(PayrollComponentMapping.IsWorkingHoursComponent("HOURS", "HOURS"));
    }

    [Fact]
    public void IsWorkedHoursQuantity_MatchesKnownHoursCodes()
    {
        Assert.True(PayrollComponentMapping.IsWorkedHoursQuantity("WORKED_HOURS"));
        Assert.True(PayrollComponentMapping.IsWorkedHoursQuantity("NO_OF_WORKED_HOURS"));
        Assert.False(PayrollComponentMapping.IsWorkedHoursQuantity("HOURLY_RATE"));
        Assert.False(PayrollComponentMapping.IsWorkedHoursQuantity("OT"));
    }

    [Fact]
    public void AliasMappedBaseAsBasic_CopiesMappedAmount()
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["PACKAGE"] = 50_000m,
        };
        PayrollCalculationEngine.AliasMappedBaseAsBasic(values, "PACKAGE");
        Assert.Equal(50_000m, values["BASIC"]);
    }

    [Fact]
    public void AliasMappedWorkingHours_SetsWorkingHoursAliases()
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["MONTHLY_HRS"] = 200m,
        };
        PayrollCalculationEngine.AliasMappedWorkingHours(values, "MONTHLY_HRS");
        Assert.Equal(200m, values["WORKING_HOURS"]);
        Assert.Equal(200m, values["HOURS_PER_MONTH"]);
    }
}
