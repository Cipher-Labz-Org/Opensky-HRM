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

    [Theory]
    [InlineData("BASIC")]
    [InlineData("basic")]
    [InlineData("BASIC1")]
    [InlineData("Basic Salary")]
    public void IsBasicComponentCode_MatchesLiveBasicAliases(string code)
    {
        Assert.True(PayrollCalculationEngine.IsBasicComponentCode(code));
    }

    [Theory]
    [InlineData("APIT", "APIT")]
    [InlineData("apit", "Tax")]
    [InlineData("PAYE", "APIT")]
    public void IsApitLine_MatchesLiveCodeOrName(string code, string name)
    {
        Assert.True(PayrollCalculationEngine.IsApitLine(code, name));
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
    [InlineData(190_000, 2_400)]
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
    [InlineData(200_000, 0, 3_000)]
    [InlineData(200_000, 50_000, 8_000)]
    [InlineData(0, 200_000, 3_000)]
    public void CalculateApit_AddsTable02OnLumpSum(decimal regular, decimal lump, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApit(regular, lump));
    }

    [Theory]
    [InlineData(3, 1)]
    [InlineData(4, 2)]
    [InlineData(9, 7)]
    [InlineData(1, 11)]
    [InlineData(2, 12)]
    public void ApitTaxYearMonthNumber_StartsInMarch(int calendarMonth, int expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ApitTaxYearMonthNumber(calendarMonth));
    }

    [Theory]
    [InlineData(560_000, 3, 107_600)]
    [InlineData(560_000, 4, 215_200)]
    [InlineData(560_000, 5, 322_800)]
    public void CalculateCumulativeApit_GrowsEachMonthFromMarch(
        decimal monthlySalary, int calendarMonth, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateCumulativeApit(monthlySalary, 0, calendarMonth));
    }

    [Theory]
    [InlineData("Monthly", 4, 107_600)]
    [InlineData("Annual", 4, 0)]
    [InlineData("Exact", 3, 161_600)]
    [InlineData("Exact", 4, 161_600)]
    [InlineData("expact", 4, 161_600)]
    public void CalculateApitByMode_MonthlyAnnualExact(string mode, int calendarMonth, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApitByMode(560_000m, 0, calendarMonth, mode));
    }

    [Fact]
    public void CalculateApitByMode_Monthly190000_UsesTable01()
    {
        Assert.Equal(2_400m, PayrollCalculationEngine.CalculateApitByMode(190_000m, 0, 4, "Monthly"));
    }

    [Theory]
    [InlineData(83_333, 4_999.98)]
    [InlineData(100_000, 8_000)]
    [InlineData(150_000, 18_500)]
    [InlineData(200_000, 32_500)]
    [InlineData(250_000, 50_000)]
    [InlineData(560_000, 161_600)]
    public void CalculateApitTable41_UsesNonResidentMonthlySlabs(decimal monthly, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApitTable41(monthly));
    }

    [Fact]
    public void CalculateExactApit_RegularOnlyMatchesTable41()
    {
        Assert.Equal(8_000m, PayrollCalculationEngine.CalculateExactApit(100_000m));
        Assert.Equal(32_500m, PayrollCalculationEngine.CalculateExactApit(200_000m));
    }

    [Fact]
    public void CalculateExactApit_AddsTable42OnLumpSum()
    {
        Assert.Equal(44_000m, PayrollCalculationEngine.CalculateExactApit(100_000m, 200_000m));
    }

    [Theory]
    [InlineData(75_000, 100_000, 0)]
    [InlineData(150_000, 200_000, 12_000)]
    [InlineData(560_000, 100_000, 36_000)]
    public void CalculateApitTable02_UsesExpectedYearlyIncome(decimal monthly, decimal bonus, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApitTable02(monthly, bonus));
    }

    [Theory]
    [InlineData(4, 1)]
    [InlineData(5, 2)]
    [InlineData(12, 9)]
    [InlineData(1, 10)]
    [InlineData(3, 12)]
    public void ApitTable02MonthIndex_StartsInApril(int calendarMonth, int expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ApitTable02MonthIndex(calendarMonth));
    }

    /// <summary>
    /// Official IRD Tax Table No. 02 worked examples (Y/A lump-sum / bonus).
    /// </summary>
    [Theory]
    [InlineData(170_000, 1, 600_000, 0, 0, 1_200, 36_000)]
    [InlineData(170_000, 9, 800_000, 600_000, 36_000, 1_200, 133_200)]
    [InlineData(300_000, 2, 600_000, 0, 0, 18_500, 168_000)]
    [InlineData(300_000, 10, 700_000, 600_000, 168_000, 18_500, 246_000)]
    public void CalculateLumpSumTax_MatchesOfficialTable02Examples(
        decimal monthlyPay,
        int currentMonthIndex,
        decimal lumpSumNow,
        decimal priorLumpSums,
        decimal priorLumpSumTaxDeducted,
        decimal monthlyTaxPerMonth,
        decimal expected)
    {
        Assert.Equal(
            expected,
            PayrollCalculationEngine.CalculateLumpSumTax(
                monthlyPay,
                currentMonthIndex,
                lumpSumNow,
                priorLumpSums,
                priorLumpSumTaxDeducted,
                monthlyTaxPerMonth));

        var scheduled = Enumerable.Repeat(monthlyPay, 12).ToArray();
        var paidRegular = new decimal?[12];
        var paidTax = new decimal?[12];
        var projection = PayrollCalculationEngine.BuildTable02YearProjection(
            currentMonthIndex, paidRegular, paidTax, scheduled,
            priorLumpSums, priorLumpSumTaxDeducted);
        Assert.Equal(
            expected,
            PayrollCalculationEngine.CalculateLumpSumTaxOnEgar(
                projection.A, projection.B, lumpSumNow, projection.PriorLumpSums,
                projection.TaxOnA, projection.TaxOnB, projection.PriorLumpSumTax));
    }

    [Fact]
    public void BuildTable02YearProjection_UsesPaidSlipsAndProjectedRemainder()
    {
        var paidRegular = new decimal?[] { 150_000m, 150_000m, 150_000m, null, null, null, null, null, null, null, null, null };
        var paidTax = new decimal?[] { 0m, 0m, 0m, null, null, null, null, null, null, null, null, null };
        var scheduled = new[]
        {
            150_000m, 150_000m, 150_000m, 200_000m, 200_000m, 200_000m,
            200_000m, 200_000m, 200_000m, 200_000m, 200_000m, 200_000m,
        };

        var projection = PayrollCalculationEngine.BuildTable02YearProjection(
            4, paidRegular, paidTax, scheduled);

        Assert.Equal(650_000m, projection.A);
        Assert.Equal(1_600_000m, projection.B);
        Assert.Equal(3_000m, projection.TaxOnA);
        Assert.Equal(24_000m, projection.TaxOnB);
        Assert.Equal(
            42_000m,
            PayrollCalculationEngine.CalculateLumpSumTaxOnEgar(
                projection.A, projection.B, 600_000m, 0, projection.TaxOnA, projection.TaxOnB, 0));
    }

    [Fact]
    public void ApitTable02CalendarForFiscalMonth_UsesAprilToMarch()
    {
        Assert.Equal((4, 2026), PayrollCalculationEngine.ApitTable02CalendarForFiscalMonth(1, 2026));
        Assert.Equal((12, 2026), PayrollCalculationEngine.ApitTable02CalendarForFiscalMonth(9, 2026));
        Assert.Equal((1, 2027), PayrollCalculationEngine.ApitTable02CalendarForFiscalMonth(10, 2026));
        Assert.Equal((3, 2027), PayrollCalculationEngine.ApitTable02CalendarForFiscalMonth(12, 2026));
    }

    [Fact]
    public void CalculateBonusApitByMode_MonthlyAndAnnualUseTable02_ExactUsesTable42()
    {
        var prior = new PayrollCalculationEngine.ConfirmedApitYtd(0, 0, 0, 0);
        Assert.Equal(12_000m, PayrollCalculationEngine.CalculateBonusApitByMode(150_000m, 200_000m, "Monthly", prior));
        Assert.Equal(36_000m, PayrollCalculationEngine.CalculateBonusApitByMode(100_000m, 200_000m, "Exact", prior));
        Assert.Equal(0m, PayrollCalculationEngine.CalculateBonusApitByMode(75_000m, 100_000m, "Annual", prior));
        Assert.Equal(
            36_000m,
            PayrollCalculationEngine.CalculateBonusApitByMode(170_000m, 600_000m, "Monthly", prior, calendarMonth: 4));
        Assert.Equal(
            36_000m,
            PayrollCalculationEngine.CalculateBonusApitByMode(170_000m, 600_000m, "Annual", prior, calendarMonth: 4));
    }

    [Fact]
    public void ResolveMonthlySalaryForLumpSum_UsesLatestPositiveWhenPeriodRowIsZero()
    {
        var componentId = Guid.NewGuid();
        var assignments = new List<EmployeeCompensation>
        {
            new()
            {
                ComponentId = componentId,
                Amount = 0,
                EffectiveFrom = new DateTime(2020, 1, 1),
                IsActive = true,
            },
            new()
            {
                ComponentId = componentId,
                Amount = 170_000m,
                EffectiveFrom = new DateTime(2026, 9, 1),
                IsActive = true,
            },
        };

        var monthly = PayrollCalculationEngine.ResolveMonthlySalaryForLumpSum(
            assignments, new DateTime(2026, 4, 1), new DateTime(2026, 4, 30));

        Assert.Equal(170_000m, monthly);
    }

    [Fact]
    public void ResolveMonthlySalaryForLumpSum_DoesNotAddEndedBasicOnTopOfCurrentBasic1()
    {
        var endedBasic = Guid.NewGuid();
        var currentBasic = Guid.NewGuid();
        var assignments = new List<EmployeeCompensation>
        {
            new()
            {
                ComponentId = endedBasic,
                Amount = 560_000m,
                EffectiveFrom = new DateTime(2020, 1, 1),
                EffectiveTo = new DateTime(2026, 3, 31),
                IsActive = true,
            },
            new()
            {
                ComponentId = currentBasic,
                Amount = 170_000m,
                EffectiveFrom = new DateTime(2026, 4, 1),
                IsActive = true,
            },
        };

        var monthly = PayrollCalculationEngine.ResolveMonthlySalaryForLumpSum(
            assignments, new DateTime(2026, 4, 1), new DateTime(2026, 4, 30));

        Assert.Equal(170_000m, monthly);
    }

    [Theory]
    [InlineData(560_000, 0, 80_000, 50_000, 560_000)]
    [InlineData(0, 0, 80_000, 50_000, 80_000)]
    [InlineData(0, 200_000, 80_000, 50_000, 200_000)]
    public void ResolveApitRegularBase_UsesSalaryForEveryEmployee(
        decimal regularEarnings, decimal taxableRegular, decimal epfBase, decimal basicPay, decimal expected)
    {
        Assert.Equal(
            expected,
            PayrollCalculationEngine.ResolveApitRegularBase(regularEarnings, taxableRegular, epfBase, basicPay));
    }

    [Theory]
    [InlineData(75_000, 0)]
    [InlineData(13_000, 0)]
    [InlineData(10_000, 0)]
    [InlineData(160_000, 600)]
    [InlineData(560_000, 107_600)]
    public void CalculateMonthlyApitWithAnnualFallback_NoMonthlyTaxUnder150000(
        decimal monthlySalary, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateMonthlyApitWithAnnualFallback(monthlySalary));
    }

    [Theory]
    [InlineData(1_800_000, 0)]
    [InlineData(2_000_000, 12_000)]
    [InlineData(2_800_000, 60_000)]
    [InlineData(4_400_000, 456_000)]
    public void CalculateApitTableAnnual_UsesIrdAnnualSlabs(decimal yearlyProfits, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateApitTableAnnual(yearlyProfits));
    }

    [Fact]
    public void CalculateAnnualApitIncrement_WithholdsDeltaOnly()
    {
        Assert.Equal(12_000m, PayrollCalculationEngine.CalculateAnnualApitIncrement(1_800_000m, 200_000m));
        Assert.Equal(12_000m, PayrollCalculationEngine.CalculateAnnualApitIncrement(2_000_000m, 200_000m));
        Assert.Equal(0m, PayrollCalculationEngine.CalculateAnnualApitIncrement(0m, 200_000m));
    }

    [Theory]
    [InlineData(75_000, 0)]
    [InlineData(13_000, 0)]
    [InlineData(560_000, 0)]
    [InlineData(2_000_000, 12_000)]
    public void CalculateAnnualApit_UsesAnnualTableOnTheGivenBase(decimal taxable, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.CalculateAnnualApit(taxable));
    }

    [Theory]
    [InlineData(3, 2026, 2026)]
    [InlineData(2, 2026, 2025)]
    [InlineData(1, 2027, 2026)]
    public void ApitTaxYearStartYear_UsesMarch(int calendarMonth, int calendarYear, int expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ApitTaxYearStartYear(calendarMonth, calendarYear));
    }

    [Fact]
    public void CalculateApitByMode_AnnualUsesConfirmedPriorYtd()
    {
        Assert.Equal(
            12_000m,
            PayrollCalculationEngine.CalculateApitByMode(200_000m, 0, 12, "Annual", 1_800_000m));
        Assert.Equal(
            0m,
            PayrollCalculationEngine.CalculateApitByMode(200_000m, 0, 4, "Annual"));
    }

    [Theory]
    [InlineData(200_000, 80_000, 50_000, 200_000)]
    [InlineData(0, 80_000, 50_000, 80_000)]
    [InlineData(0, 0, 50_000, 50_000)]
    public void ResolveTaxableBase_FallsBackToEpfThenBasic(
        decimal taxableRegular, decimal epfBase, decimal basicPay, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ResolveTaxableBase(taxableRegular, epfBase, basicPay));
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
