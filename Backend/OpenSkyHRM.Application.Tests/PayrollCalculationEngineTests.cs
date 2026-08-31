using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollCalculationEngineTests
{
    private static readonly Guid EmpA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid CompBasic = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid CompBasic1 = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    [Fact]
    public void SelectAssignmentsForPeriod_UsesLatestWhenEffectiveFromIsAfterPeriod()
    {
        var assignments = new List<EmployeeCompensation>
        {
            new()
            {
                EmployeeId = EmpA,
                ComponentId = CompBasic,
                Amount = 50_000m,
                EffectiveFrom = new DateTime(2026, 8, 31),
                IsActive = true,
                Component = new CompensationComponent
                {
                    Id = CompBasic,
                    Code = "BASIC1",
                    Category = ComponentCategory.Fixed,
                    Type = ComponentType.Earning,
                },
            },
        };

        var selected = PayrollCalculationEngine.SelectAssignmentsForPeriod(
            assignments,
            new DateTime(2026, 7, 1),
            new DateTime(2026, 7, 31));

        Assert.Single(selected);
        Assert.Equal(50_000m, selected[0].Amount);
    }

    [Fact]
    public void SelectAssignmentsForPeriod_PrefersOverlappingRowOverNewerOutOfRangeRow()
    {
        var assignments = new List<EmployeeCompensation>
        {
            new()
            {
                EmployeeId = EmpA,
                ComponentId = CompBasic,
                Amount = 40_000m,
                EffectiveFrom = new DateTime(2026, 7, 1),
                EffectiveTo = new DateTime(2026, 7, 31),
                IsActive = true,
                Component = new CompensationComponent { Id = CompBasic, Code = "BASIC", Category = ComponentCategory.Fixed },
            },
            new()
            {
                EmployeeId = EmpA,
                ComponentId = CompBasic,
                Amount = 55_000m,
                EffectiveFrom = new DateTime(2026, 8, 1),
                IsActive = true,
                Component = new CompensationComponent { Id = CompBasic, Code = "BASIC", Category = ComponentCategory.Fixed },
            },
        };

        var selected = PayrollCalculationEngine.SelectAssignmentsForPeriod(
            assignments,
            new DateTime(2026, 7, 1),
            new DateTime(2026, 7, 31));

        Assert.Single(selected);
        Assert.Equal(40_000m, selected[0].Amount);
    }

    [Fact]
    public void ResolveBasicPay_UsesBasic1WhenBasicMissing()
    {
        var resolved = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC1"] = 50_000m,
        };

        var basic = PayrollCalculationEngine.ResolveBasicPay(resolved, [], 50_000m);

        Assert.Equal(50_000m, basic);
    }

    [Fact]
    public void ResolveBasicPay_PrefersExplicitBasicCode()
    {
        var resolved = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC"] = 45_000m,
            ["BASIC1"] = 50_000m,
        };

        var basic = PayrollCalculationEngine.ResolveBasicPay(resolved, [], 50_000m);

        Assert.Equal(45_000m, basic);
    }
}
