using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Idempotent catalog of default payroll compensation components for every tenant database.
/// Runs on system startup so Payroll is usable without manual component setup.
/// </summary>
public static class PayrollComponentSeeder
{
    private readonly record struct PayrollComponentDefinition(
        string Name,
        string Code,
        ComponentType Type,
        ComponentCategory Category,
        int SortOrder,
        string Description,
        bool IsTaxable = false,
        bool IsStatutory = false,
        bool IsEmployerContribution = false,
        string? FormulaExpression = null,
        string? DependsOnComponentCode = null);

    private static readonly PayrollComponentDefinition[] DefaultComponents =
    [
        // Fixed earnings
        new("Basic Salary", "BASIC", ComponentType.Earning, ComponentCategory.Fixed, 10,
            "Monthly basic salary", IsTaxable: true),
        new("Transport Allowance", "TA", ComponentType.Earning, ComponentCategory.Fixed, 20,
            "Monthly transport / travel allowance", IsTaxable: true),
        new("Meal Allowance", "MEAL", ComponentType.Earning, ComponentCategory.Fixed, 30,
            "Daily meal / food allowance"),
        new("Housing Allowance", "HOUSING", ComponentType.Earning, ComponentCategory.Fixed, 40,
            "Monthly housing / rent allowance", IsTaxable: true),
        new("Communication Allowance", "COMM", ComponentType.Earning, ComponentCategory.Fixed, 50,
            "Phone and internet allowance"),
        new("Medical Allowance", "MEDICAL", ComponentType.Earning, ComponentCategory.Fixed, 60,
            "Monthly medical / health allowance"),
        new("Attendance Allowance", "ATTEND", ComponentType.Earning, ComponentCategory.Fixed, 70,
            "Allowance for full attendance in the month", IsTaxable: true),

        // Variable earnings
        new("Overtime", "OT", ComponentType.Earning, ComponentCategory.Variable, 100,
            "Overtime pay for additional hours worked", IsTaxable: true),
        new("Commission", "COMMISSION", ComponentType.Earning, ComponentCategory.Variable, 110,
            "Sales commission or performance-based pay", IsTaxable: true),
        new("Incentive", "INCENTIVE", ComponentType.Earning, ComponentCategory.Variable, 120,
            "Performance incentive payment", IsTaxable: true),

        // One-time earnings
        new("Bonus", "BONUS", ComponentType.Earning, ComponentCategory.OneTime, 200,
            "Annual or special bonus payment", IsTaxable: true),
        new("Festival Advance", "FESTIVAL", ComponentType.Earning, ComponentCategory.OneTime, 210,
            "Festival advance (Sinhala/Tamil New Year, Vesak, etc.)"),

        // Deductions
        new("Loan Deduction", "LOAN", ComponentType.Deduction, ComponentCategory.Fixed, 300,
            "Monthly loan / advance repayment deduction"),
        new("No-Pay Deduction", "NOPAY", ComponentType.Deduction, ComponentCategory.Variable, 310,
            "Deduction for no-pay leave days",
            FormulaExpression: "BASIC / 30 * NOPAY_DAYS", DependsOnComponentCode: "BASIC"),
        new("Salary Advance", "ADVANCE", ComponentType.Deduction, ComponentCategory.Variable, 320,
            "Salary advance recovery"),
        new("Insurance Premium", "INSURANCE", ComponentType.Deduction, ComponentCategory.Fixed, 330,
            "Employee insurance premium deduction"),

        // Statutory
        new("EPF - Employee 8%", "EPF_EE", ComponentType.StatutoryDeduction, ComponentCategory.Statutory, 900,
            "Employee Provident Fund — employee contribution (8% of gross)",
            IsStatutory: true,
            FormulaExpression: "TAXABLE_EARNINGS * EPF_EE_RATE", DependsOnComponentCode: "TAXABLE_EARNINGS"),
        new("EPF - Employer 12%", "EPF_ER", ComponentType.StatutoryContribution, ComponentCategory.Statutory, 910,
            "Employee Provident Fund — employer contribution (12% of gross)",
            IsStatutory: true, IsEmployerContribution: true,
            FormulaExpression: "TAXABLE_EARNINGS * EPF_ER_RATE", DependsOnComponentCode: "TAXABLE_EARNINGS"),
        new("ETF - Employer 3%", "ETF_ER", ComponentType.StatutoryContribution, ComponentCategory.Statutory, 920,
            "Employee Trust Fund — employer contribution (3% of gross)",
            IsStatutory: true, IsEmployerContribution: true,
            FormulaExpression: "TAXABLE_EARNINGS * ETF_RATE", DependsOnComponentCode: "TAXABLE_EARNINGS"),
    ];

    private static readonly (string Key, string Value, string Description)[] DefaultSystemSettings =
    [
        ("Payroll_EPF_EmployeeRate", "0.08", "EPF employee contribution rate"),
        ("Payroll_EPF_EmployerRate", "0.12", "EPF employer contribution rate"),
        ("Payroll_ETF_EmployerRate", "0.03", "ETF employer contribution rate"),
        ("Payroll_OT_HourlyDivisor", "208", "Hourly rate divisor for OT (BASIC / divisor × multiplier × hours)"),
        ("Payroll_OT_Multiplier", "1.5", "OT pay multiplier (e.g. 1.5 for time-and-a-half)"),
    ];

    /// <summary>
    /// Ensures the full default payroll component catalog and rate settings exist (idempotent).
    /// </summary>
    public static async Task EnsureAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var existingCodes = await context.CompensationComponents
            .AsNoTracking()
            .Select(c => c.Code)
            .ToListAsync(cancellationToken);
        var knownCodes = new HashSet<string>(existingCodes, StringComparer.OrdinalIgnoreCase);

        foreach (var definition in DefaultComponents)
        {
            if (knownCodes.Contains(definition.Code))
                continue;

            context.CompensationComponents.Add(ToEntity(definition));
        }

        foreach (var (key, value, description) in DefaultSystemSettings)
        {
            if (await context.SystemSettings.FindAsync([key], cancellationToken) is not null)
                continue;

            context.SystemSettings.Add(new SystemSetting
            {
                Key = key,
                Value = value,
                Description = description,
            });
        }
    }

    private static CompensationComponent ToEntity(PayrollComponentDefinition definition) =>
        new()
        {
            Name = definition.Name,
            Code = definition.Code,
            Type = definition.Type,
            Category = definition.Category,
            SortOrder = definition.SortOrder,
            Description = definition.Description,
            IsTaxable = definition.IsTaxable,
            IsStatutory = definition.IsStatutory,
            IsEmployerContribution = definition.IsEmployerContribution,
            FormulaExpression = definition.FormulaExpression,
            DependsOnComponentCode = definition.DependsOnComponentCode,
            IsActive = true,
        };
}
