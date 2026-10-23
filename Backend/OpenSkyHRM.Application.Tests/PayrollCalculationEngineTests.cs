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
    [InlineData(ComponentType.Earning)]
    public void IsEarningComponentType_IncludesIncomeOnly(ComponentType type)
    {
        Assert.True(PayrollCalculationEngine.IsEarningComponentType(type));
        Assert.True(PayrollCalculationEngine.IsEarningComponentType(type.ToString()));
        Assert.True(PayrollCalculationEngine.IsEarningComponentType("Income"));
    }

    [Theory]
    [InlineData(ComponentType.Deduction)]
    [InlineData(ComponentType.StatutoryDeduction)]
    [InlineData(ComponentType.StatutoryContribution)]
    [InlineData(ComponentType.Day)]
    [InlineData(ComponentType.Hours)]
    [InlineData(ComponentType.Rate)]
    public void IsEarningComponentType_ExcludesDeductionsRateAndQuantity(ComponentType type)
    {
        Assert.False(PayrollCalculationEngine.IsEarningComponentType(type));
        Assert.False(PayrollCalculationEngine.IsEarningComponentType(type.ToString()));
    }

    [Fact]
    public void HourlyRateAndWorkedHours_AreInputsNotEarnings()
    {
        var hourly = new CompensationComponent { Code = "HOURLY_RATE", Type = ComponentType.Hours };
        var hours = new CompensationComponent { Code = "WORKED_HOURS", Type = ComponentType.Hours };
        var pay = new CompensationComponent { Code = "TOTAL_PAYMENT", Type = ComponentType.Hours };

        Assert.True(PayrollCalculationEngine.IsRateOrQuantityComponent(hourly));
        Assert.True(PayrollCalculationEngine.IsRateOrQuantityComponent(hours));
        Assert.False(PayrollCalculationEngine.IsRateOrQuantityComponent(pay));
        Assert.False(PayrollCalculationEngine.CountsAsEarning(hourly));
        Assert.True(PayrollCalculationEngine.CountsAsEarning(pay));
        Assert.Equal("HOURLY_RATE * WORKED_HOURS", PayrollCalculationEngine.DefaultHoursPayFormula(pay));
    }

    [Fact]
    public void EvaluateFormula_HourlyRateTimesWorkedHours()
    {
        var amount = PayrollCalculationEngine.EvaluateFormula(
            "HOURLY_RATE * WORKED_HOURS",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["HOURLY_RATE"] = 222m,
                ["WORKED_HOURS"] = 8.30m,
            },
            new PayrollRates());

        Assert.Equal(1842.60m, amount);
    }

    [Fact]
    public void EvaluateFormula_Basic1DividedByWorkingDays()
    {
        var amount = PayrollCalculationEngine.EvaluateFormula(
            "BASIC1 / WORKING_DAYS",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["BASIC1"] = 52_000m,
                ["WORKING_DAYS"] = 26m,
            },
            new PayrollRates());

        Assert.Equal(2000m, amount);
    }

    [Fact]
    public void EvaluateFormula_RoundsDailyAndHourlyRatesToTwoDecimals()
    {
        var perDay = PayrollCalculationEngine.EvaluateFormula(
            "PACKAGE / 22",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["PACKAGE"] = 40_500m,
            },
            new PayrollRates());
        var perHour = PayrollCalculationEngine.EvaluateFormula(
            "PACKAGE / 22 / 8.30",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["PACKAGE"] = 40_500m,
            },
            new PayrollRates());

        Assert.Equal(1840.91m, perDay);
        Assert.Equal(221.80m, perHour);
    }

    [Fact]
    public void EvaluateFormula_RoundResultRoundsToNearestRupee()
    {
        var amount = PayrollCalculationEngine.EvaluateFormula(
            "PACKAGE / 22",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["PACKAGE"] = 40_500m,
            },
            new PayrollRates(),
            roundResult: true);

        Assert.Equal(1841m, amount);
    }

    [Theory]
    [InlineData(1840.91, false, 1840.91)]
    [InlineData(1840.91, true, 1841)]
    [InlineData(1840.40, true, 1840)]
    public void ApplyComponentRounding_HonorsRoundFlag(decimal value, bool roundResult, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ApplyComponentRounding(value, roundResult));
    }

    [Fact]
    public void CalculateOtAmount_RoundsHourlyRateToTwoDecimalsBeforeHours()
    {
        var amount = PayrollCalculationEngine.CalculateOtAmount(100_000m, 208m, 1.5m, 10m);

        Assert.Equal(7211.55m, amount);
    }

    [Fact]
    public void EvaluateFormula_Basic1FallsBackToBasic()
    {
        var amount = PayrollCalculationEngine.EvaluateFormula(
            "BASIC1 / WORKING_DAYS",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["BASIC"] = 52_000m,
                ["WORKING_DAYS"] = 26m,
            },
            new PayrollRates());

        Assert.Equal(2000m, amount);
    }

    [Fact]
    public void EvaluateFormula_WorkingDaysZeroIsZero()
    {
        var amount = PayrollCalculationEngine.EvaluateFormula(
            "BASIC1 / WORKING_DAYS",
            new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
            {
                ["BASIC1"] = 52_000m,
                ["WORKING_DAYS"] = 0m,
            },
            new PayrollRates());

        Assert.Equal(0m, amount);
    }

    [Fact]
    public void SeedAssignmentValues_LetsPerDayFormulaSeeInputsRegardlessOfSortOrder()
    {
        var basicId = Guid.NewGuid();
        var daysId = Guid.NewGuid();
        var perDayId = Guid.NewGuid();
        var components = new List<CompensationComponent>
        {
            new()
            {
                Id = perDayId,
                Code = "PER_DAY",
                Name = "Per Day Salary",
                Category = ComponentCategory.Fixed,
                Type = ComponentType.Rate,
                FormulaExpression = "BASIC1 / WORKING_DAYS",
                SortOrder = 1,
            },
            new()
            {
                Id = basicId,
                Code = "BASIC1",
                Name = "Basic Salary",
                Category = ComponentCategory.Fixed,
                Type = ComponentType.Earning,
                SortOrder = 2,
            },
            new()
            {
                Id = daysId,
                Code = "WORKING_DAYS",
                Name = "Working Days",
                Category = ComponentCategory.Fixed,
                Type = ComponentType.Day,
                SortOrder = 3,
            },
        };
        var empComp = new List<EmployeeCompensation>
        {
            new() { ComponentId = basicId, Amount = 52_000m, Component = components[1] },
            new() { ComponentId = daysId, Amount = 26m, Component = components[2] },
        };

        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        PayrollCalculationEngine.SeedAssignmentValues(values, components, empComp);

        var perDay = PayrollCalculationEngine.EvaluateFormula(
            "BASIC1 / WORKING_DAYS", values, new PayrollRates());

        Assert.Equal(2000m, perDay);
        Assert.Equal(52_000m, values["BASIC1"]);
        Assert.Equal(26m, values["WORKING_DAYS"]);
    }

    [Fact]
    public void SeedWorkedHoursFromAttendance_UsesMonthTotalWhenUnsaved()
    {
        var hoursId = Guid.NewGuid();
        var components = new List<CompensationComponent>
        {
            new()
            {
                Id = hoursId,
                Code = "WORKED_HOURS",
                Name = "Working Hours for Month",
                Category = ComponentCategory.Variable,
                Type = ComponentType.Hours,
            },
        };

        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        PayrollCalculationEngine.SeedWorkedHoursFromAttendance(values, components, new List<EmployeeCompensation>(), 193.45m);

        Assert.Equal(193.45m, values["WORKED_HOURS"]);
    }

    [Fact]
    public void SeedWorkedHoursFromAttendance_KeepsSavedOverride()
    {
        var hoursId = Guid.NewGuid();
        var hours = new CompensationComponent
        {
            Id = hoursId,
            Code = "WORKED_HOURS",
            Name = "Working Hours for Month",
            Category = ComponentCategory.Variable,
            Type = ComponentType.Hours,
        };
        var empComp = new List<EmployeeCompensation>
        {
            new() { ComponentId = hoursId, Amount = 160m, Component = hours },
        };

        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        PayrollCalculationEngine.SeedWorkedHoursFromAttendance(values, new List<CompensationComponent> { hours }, empComp, 193.45m);

        Assert.Equal(160m, values["WORKED_HOURS"]);
    }

    /// <summary>
    /// Live catalogs leave SortOrder at 0, so PACKAGE -> PER_DAY -> HOURLY_RATEE -> NOPAY_EXE
    /// used to evaluate in catalog order and the payslip drifted from Employee Salary.
    /// </summary>
    [Fact]
    public void OrderComponentsForEvaluation_ChainedFormulasMatchEmployeeSalary()
    {
        CompensationComponent Plain(string code) => new()
        {
            Id = Guid.NewGuid(), Code = code, Name = code,
            Category = ComponentCategory.Fixed, Type = ComponentType.Earning, SortOrder = 0,
        };
        CompensationComponent Formula(string code, string expression) => new()
        {
            Id = Guid.NewGuid(), Code = code, Name = code,
            Category = ComponentCategory.Fixed, Type = ComponentType.Earning, SortOrder = 0,
            FormulaExpression = expression, RoundResult = true,
        };

        // Deliberately listed dependents-first, the order the live catalog returned.
        var components = new List<CompensationComponent>
        {
            Formula("NOPAY_EXE", "BASIC + TA - HOURLY_RATEE * HOURS_PER_MONTH"),
            Formula("HOURLY_RATEE", "PER_DAY / PER_DAY_WORK"),
            Formula("PER_DAY", "PACKAGE / WORKING_DAYS"),
            new()
            {
                Id = Guid.NewGuid(), Code = "PACKAGE", Name = "Package",
                Category = ComponentCategory.Fixed, Type = ComponentType.Earning, SortOrder = 0,
                FormulaExpression = "BASIC + TA",
            },
            Plain("BASIC"), Plain("TA"), Plain("WORKING_DAYS"),
            Plain("PER_DAY_WORK"), Plain("HOURS_PER_MONTH"),
        };

        var ordered = PayrollCalculationEngine.OrderComponentsForEvaluation(components);

        var position = ordered
            .Select((c, i) => (c.Code, i))
            .ToDictionary(x => x.Code, x => x.i);
        Assert.True(position["PACKAGE"] < position["PER_DAY"]);
        Assert.True(position["PER_DAY"] < position["HOURLY_RATEE"]);
        Assert.True(position["HOURLY_RATEE"] < position["NOPAY_EXE"]);
        Assert.Equal(components.Count, ordered.Count);

        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC"] = 30_000m,
            ["TA"] = 10_500m,
            ["WORKING_DAYS"] = 22m,
            ["PER_DAY_WORK"] = 8.30m,
            ["HOURS_PER_MONTH"] = 23.11m,
        };
        foreach (var comp in ordered.Where(c => !string.IsNullOrEmpty(c.FormulaExpression)))
        {
            values[comp.Code] = PayrollCalculationEngine.EvaluateFormula(
                comp.FormulaExpression!, values, new PayrollRates(), comp.RoundResult);
        }

        Assert.Equal(1_841m, values["PER_DAY"]);
        Assert.Equal(222m, values["HOURLY_RATEE"]);
        Assert.Equal(35_370m, values["NOPAY_EXE"]);
    }

    /// <summary>
    /// "Round result" used to reach only formula components, so turning it on for a plain
    /// allowance such as Hospital Allowance silently did nothing on the payslip.
    /// </summary>
    [Theory]
    [InlineData(true, 2439)]
    [InlineData(false, 2438.99)]
    public void ApplyComponentRounding_RoundsEnteredAmountsNotJustFormulaResults(
        bool roundResult, decimal expected)
    {
        Assert.Equal(expected, PayrollCalculationEngine.ApplyComponentRounding(2438.99m, roundResult));
    }

    [Fact]
    public void ApplyComponentRounding_IsIdempotentSoReRoundingDoesNotDrift()
    {
        var once = PayrollCalculationEngine.ApplyComponentRounding(1_840.91m, true);
        Assert.Equal(1_841m, once);
        Assert.Equal(once, PayrollCalculationEngine.ApplyComponentRounding(once, true));
    }

    /// <summary>
    /// Variable amounts are saved against one batch, so the next batch starts empty. Hours Per Month
    /// feeds the No-Pay formula, so losing it turned the deduction into the whole package; OT and
    /// commission must stay month-specific.
    /// </summary>
    [Fact]
    public void FormulaInputComponentCodes_SelectsOnlyManualInputsOtherFormulasRead()
    {
        CompensationComponent Variable(string code, string? expression = null) => new()
        {
            Id = Guid.NewGuid(), Code = code, Name = code,
            Category = ComponentCategory.Variable, Type = ComponentType.Earning,
            FormulaExpression = expression,
        };

        var components = new List<CompensationComponent>
        {
            Variable("HOURS_PER_MONTH"),
            Variable("OT"),
            Variable("COMMISSION"),
            Variable("INCENTIVE"),
            Variable("NOPAY_EXE", "BASIC + TA - HOURLY_RATEE * HOURS_PER_MONTH"),
            new()
            {
                Id = Guid.NewGuid(), Code = "BASIC", Name = "Basic",
                Category = ComponentCategory.Fixed, Type = ComponentType.Earning,
            },
        };

        var codes = PayrollCalculationEngine.FormulaInputComponentCodes(
            components, ComponentCategory.Variable);

        Assert.Equal(["HOURS_PER_MONTH"], codes);
    }

    [Fact]
    public void FormulaInputComponentCodes_IgnoresCategoriesOtherThanRequested()
    {
        var components = new List<CompensationComponent>
        {
            new()
            {
                Id = Guid.NewGuid(), Code = "WORKING_DAYS", Name = "Working Days",
                Category = ComponentCategory.Fixed, Type = ComponentType.Earning,
            },
            new()
            {
                Id = Guid.NewGuid(), Code = "PER_DAY", Name = "Per Day",
                Category = ComponentCategory.Fixed, Type = ComponentType.Earning,
                FormulaExpression = "PACKAGE / WORKING_DAYS",
            },
        };

        Assert.Empty(PayrollCalculationEngine.FormulaInputComponentCodes(
            components, ComponentCategory.Variable));
        Assert.Equal(
            ["WORKING_DAYS"],
            PayrollCalculationEngine.FormulaInputComponentCodes(
                components, ComponentCategory.Fixed));
    }

    [Fact]
    public void OrderComponentsForEvaluation_KeepsCyclicFormulasWithoutLooping()
    {
        var a = new CompensationComponent
        {
            Id = Guid.NewGuid(), Code = "A", Name = "A",
            Category = ComponentCategory.Fixed, FormulaExpression = "B + 1",
        };
        var b = new CompensationComponent
        {
            Id = Guid.NewGuid(), Code = "B", Name = "B",
            Category = ComponentCategory.Fixed, FormulaExpression = "A + 1",
        };

        var ordered = PayrollCalculationEngine.OrderComponentsForEvaluation([a, b]);

        Assert.Equal(2, ordered.Count);
        Assert.Contains(a, ordered);
        Assert.Contains(b, ordered);
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

    [Theory]
    [InlineData(150_000, 1, 5_000)]
    [InlineData(60_000, 2, 4_000)]
    [InlineData(150_000, 0, 0)]
    public void EvaluateFormula_NopayIsBasicDividedBy30TimesDays(decimal basic, decimal days, decimal expected)
    {
        var values = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
        {
            ["BASIC"] = basic,
            ["NOPAY_DAYS"] = days,
        };

        var amount = PayrollCalculationEngine.EvaluateFormula(
            "BASIC / 30 * NOPAY_DAYS", values, new PayrollRates());

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
    [InlineData(560_000, 0, 80_000, 50_000, false, 560_000)]
    [InlineData(0, 0, 80_000, 50_000, false, 80_000)]
    [InlineData(0, 200_000, 80_000, 50_000, false, 200_000)]
    [InlineData(0, 0, 80_000, 50_000, true, 0)]
    [InlineData(0, 0, 80_000, 200_000, true, 0)]
    public void ResolveApitRegularBase_UsesSalaryForEveryEmployee(
        decimal regularEarnings,
        decimal taxableRegular,
        decimal epfBase,
        decimal basicPay,
        bool freelancer,
        decimal expected)
    {
        Assert.Equal(
            expected,
            PayrollCalculationEngine.ResolveApitRegularBase(
                regularEarnings, taxableRegular, epfBase, basicPay, freelancer));
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
    [InlineData(60_000, 210_040, 60_000, 60_000, false, 210_040)]
    [InlineData(150_000, 155_000, 150_000, 80_000, false, 155_000)]
    [InlineData(0, 155_000, 150_000, 80_000, false, 155_000)]
    public void ResolveApitRegularBase_UsesFullRegularSalaryWhenPaid(
        decimal taxableRegular,
        decimal regularEarnings,
        decimal epfBase,
        decimal basicPay,
        bool freelancer,
        decimal expected)
    {
        Assert.Equal(
            expected,
            PayrollCalculationEngine.ResolveApitRegularBase(
                regularEarnings, taxableRegular, epfBase, basicPay, freelancer));
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
        Assert.Equal(0m, PayrollPoyaComponent.ResolveDays(null, 0.5m));
        Assert.Equal(0m, PayrollPoyaComponent.ResolveDays(30_000m, 0.5m));
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
