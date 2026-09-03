using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain;
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

    [Theory]
    [InlineData(30_000, 0)]
    [InlineData(150_000, 0)]
    [InlineData(200_000, 3_000)]
    [InlineData(250_000, 8_000)]
    [InlineData(300_000, 18_500)]
    [InlineData(350_000, 32_500)]
    [InlineData(400_000, 50_000)]
    public void CalculateApitTable01_UsesIrdMonthlySlabs(decimal taxable, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApitTable01(taxable));
    }

    [Theory]
    [InlineData(41_000, 1, 1_366.67)]
    [InlineData(30_000, 0.5, 500)]
    [InlineData(30_000, 1, 1_000)]
    [InlineData(41_000, 0, 0)]
    public void EvaluateFormula_PoyaPayIsBasicDividedBy30TimesDays(decimal basic, decimal days, decimal expected)
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC"] = basic,
            ["POYA_DAYS"] = days,
        };

        var amount = PayrollCalculationEngine.EvaluateFormula(
            PayrollPoyaComponent.FormulaExpression, values, new PayrollRates());

        Assert.Equal(expected, amount);
    }

    [Fact]
    public void EvaluateFormula_MissingPoyaDaysIsZero()
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC"] = 30_000m,
        };

        var amount = PayrollCalculationEngine.EvaluateFormula(
            PayrollPoyaComponent.FormulaExpression, values, new PayrollRates());

        Assert.Equal(0m, amount);
    }

    [Theory]
    [InlineData(100_000, 0, 80_000, 100_000, 100_000)]
    [InlineData(0, 0, 80_000, 80_000, 80_000)]
    [InlineData(100_000, 50_000, 80_000, 100_000, 50_000)]
    public void ResolveStatutoryBases_UsesEpfBaseForEtfWhenEtfUnset(
        decimal epfEarnings, decimal etfEarnings, decimal basicPay,
        decimal expectedEpfBase, decimal expectedEtfBase)
    {
        var (epfBase, etfBase) = PayrollCalculationEngine.ResolveStatutoryBases(
            epfEarnings, etfEarnings, basicPay);

        Assert.Equal(expectedEpfBase, epfBase);
        Assert.Equal(expectedEtfBase, etfBase);
    }

    [Theory]
    [InlineData(0.08, 0.08)]
    [InlineData(8, 0.08)]
    [InlineData(12, 0.12)]
    public void NormalizePayrollRate_AcceptsDecimalOrWholePercent(decimal input, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.NormalizePayrollRate(input));
    }
}

public class PayrollPoyaAttendanceTests
{
    [Fact]
    public void CountDaysWorked_PresentOnPoyaIsOneDay()
    {
        var days = PayrollPoyaAttendance.CountDaysWorked(
            [new DateTime(2026, 7, 29)],
            [(new DateTime(2026, 7, 29), "Present", DateTime.UtcNow)]);

        Assert.Equal(1m, days);
    }

    [Fact]
    public void CountDaysWorked_HalfDayOnPoyaIsHalf()
    {
        var days = PayrollPoyaAttendance.CountDaysWorked(
            [new DateTime(2026, 7, 29)],
            [(new DateTime(2026, 7, 29), "Half Day", DateTime.UtcNow)]);

        Assert.Equal(0.5m, days);
    }

    [Fact]
    public void CountDaysWorked_AbsentOnPoyaIsZero()
    {
        var days = PayrollPoyaAttendance.CountDaysWorked(
            [new DateTime(2026, 7, 29)],
            [(new DateTime(2026, 7, 29), "Absent", null)]);

        Assert.Equal(0m, days);
    }

    [Fact]
    public void ResolveDays_ManualDayCountOverridesAttendance()
    {
        Assert.Equal(1m, PayrollPoyaComponent.ResolveDays(1m, 0.5m));
        Assert.Equal(0.5m, PayrollPoyaComponent.ResolveDays(null, 0.5m));
        Assert.Equal(0.5m, PayrollPoyaComponent.ResolveDays(30_000m, 0.5m));
    }
}

public class PayrollPeriodOccupancyTests
{
    [Fact]
    public void CanonicalStatementIds_KeepsOneSlipPerEmployeeMonthAndProcessType()
    {
        var empA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var empB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var first = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var duplicate = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var other = Guid.Parse("33333333-3333-3333-3333-333333333333");

        var keep = PayrollPeriodOccupancy.CanonicalStatementIds(
        [
            new(first, empA, 9, 2026, PayrollProcessType.Salary, PayStatementStatus.Finalized, new DateTime(2026, 9, 2)),
            new(duplicate, empA, 9, 2026, PayrollProcessType.Salary, PayStatementStatus.Draft, new DateTime(2026, 9, 10)),
            new(other, empB, 9, 2026, PayrollProcessType.Salary, PayStatementStatus.Draft, new DateTime(2026, 9, 10)),
        ]);

        Assert.Equal(2, keep.Count);
        Assert.Contains(first, keep);
        Assert.Contains(other, keep);
        Assert.DoesNotContain(duplicate, keep);
    }
}
