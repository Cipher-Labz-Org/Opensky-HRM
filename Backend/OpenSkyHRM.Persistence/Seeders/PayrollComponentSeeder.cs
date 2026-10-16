using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain;
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
        bool IsEpfApplicable = false,
        bool IsEtfApplicable = false,
        bool IsStatutory = false,
        bool IsEmployerContribution = false,
        string? FormulaExpression = null,
        string? DependsOnComponentCode = null);

    private static readonly PayrollComponentDefinition[] DefaultComponents =
    [
        // Fixed earnings
        new("Basic Salary", "BASIC", ComponentType.Earning, ComponentCategory.Fixed, 10,
            "Monthly basic salary", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Transport Allowance", "TA", ComponentType.Earning, ComponentCategory.Fixed, 20,
            "Monthly transport / travel allowance", IsTaxable: true),
        new("Meal Allowance", "MEAL", ComponentType.Earning, ComponentCategory.Fixed, 30,
            "Daily meal / food allowance"),
        new("Housing Allowance", "HOUSING", ComponentType.Earning, ComponentCategory.Fixed, 40,
            "Monthly housing / rent allowance", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Communication Allowance", "COMM", ComponentType.Earning, ComponentCategory.Fixed, 50,
            "Phone and internet allowance"),
        new("Medical Allowance", "MEDICAL", ComponentType.Earning, ComponentCategory.Fixed, 60,
            "Monthly medical / health allowance"),
        new("Attendance Allowance", "ATTEND", ComponentType.Earning, ComponentCategory.Fixed, 70,
            "Allowance for full attendance in the month", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Poya Day Pay", PayrollPoyaComponent.DefaultCode, ComponentType.Earning, ComponentCategory.Fixed, 15,
            "Pay for days worked on a Poya holiday (Basic ÷ 30 × Poya days); paid but not in EPF/ETF or monthly APIT Table 01 base",
            IsTaxable: false, IsEpfApplicable: false, IsEtfApplicable: false,
            FormulaExpression: PayrollPoyaComponent.FormulaExpression,
            DependsOnComponentCode: PayrollPoyaComponent.DependsOnComponentCode),

        // Variable earnings
        new("Overtime", "OT", ComponentType.Earning, ComponentCategory.Variable, 100,
            "Overtime pay for additional hours worked", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Commission", "COMMISSION", ComponentType.Earning, ComponentCategory.Variable, 110,
            "Sales commission or performance-based pay", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Incentive", "INCENTIVE", ComponentType.Earning, ComponentCategory.Variable, 120,
            "Performance incentive payment", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),

        // One-time earnings
        new("Bonus", "BONUS", ComponentType.Earning, ComponentCategory.OneTime, 200,
            "Annual or special bonus payment", IsTaxable: true, IsEpfApplicable: true, IsEtfApplicable: true),
        new("Festival Advance", "FESTIVAL", ComponentType.Earning, ComponentCategory.OneTime, 210,
            "Festival advance (Sinhala/Tamil New Year, Vesak, etc.)"),

        // Deductions
        new("Loan Deduction", "LOAN", ComponentType.Deduction, ComponentCategory.Fixed, 300,
            "Monthly loan / advance repayment deduction"),
        new("No-Pay Deduction", "NOPAY", ComponentType.Deduction, ComponentCategory.Variable, 310,
            "Deduction for no-pay leave days",
            FormulaExpression: "BASIC / 30 * NOPAY_DAYS", DependsOnComponentCode: "BASIC"),
        new("Salary Advance", "ADVANCE", ComponentType.Deduction, ComponentCategory.Fixed, 320,
            "Salary advance recovery"),
        new("Insurance Premium", "INSURANCE", ComponentType.Deduction, ComponentCategory.Fixed, 330,
            "Employee insurance premium deduction"),

        // Statutory
        new("EPF - Employee 8%", "EPF_EE", ComponentType.StatutoryDeduction, ComponentCategory.Statutory, 900,
            "Employee Provident Fund — employee contribution (8% of EPF-applicable earnings)",
            IsStatutory: true,
            FormulaExpression: "EPF_EARNINGS * EPF_EE_RATE", DependsOnComponentCode: "EPF_EARNINGS"),
        new("EPF - Employer 12%", "EPF_ER", ComponentType.StatutoryContribution, ComponentCategory.Statutory, 910,
            "Employee Provident Fund — employer contribution (12% of EPF-applicable earnings)",
            IsStatutory: true, IsEmployerContribution: true,
            FormulaExpression: "EPF_EARNINGS * EPF_ER_RATE", DependsOnComponentCode: "EPF_EARNINGS"),
        new("ETF - Employer 3%", "ETF_ER", ComponentType.StatutoryContribution, ComponentCategory.Statutory, 920,
            "Employee Trust Fund — employer contribution (3% of ETF-applicable earnings)",
            IsStatutory: true, IsEmployerContribution: true,
            FormulaExpression: "ETF_EARNINGS * ETF_RATE", DependsOnComponentCode: "ETF_EARNINGS"),
        new("APIT", "APIT", ComponentType.StatutoryDeduction, ComponentCategory.Statutory, 905,
            "Advance Personal Income Tax — Table 01 when monthly salary is over LKR 150,000; otherwise annual tax on yearly salary only",
            IsStatutory: true,
            FormulaExpression: "APIT_AMOUNT", DependsOnComponentCode: "TAXABLE_EARNINGS"),
    ];

    private static readonly (string Key, string Value, string Description)[] DefaultSystemSettings =
    [
        ("Payroll_EPF_EmployeeRate", "0.08", "EPF employee contribution rate"),
        ("Payroll_EPF_EmployerRate", "0.12", "EPF employer contribution rate"),
        ("Payroll_ETF_EmployerRate", "0.03", "ETF employer contribution rate"),
        ("Payroll_OT_HourlyDivisor", "208", "Hourly rate divisor for OT (BASIC / divisor × multiplier × hours)"),
        ("Payroll_OT_Multiplier", "1.5", "OT pay multiplier (e.g. 1.5 for time-and-a-half)"),
        ("Payroll_APIT_TaxMode", "Monthly", "APIT tax mode: Monthly (IRD Table 01), Annual, or Exact"),
        ("Payroll_SalaryPeriod_StartDay", "1", "Day of month salary attendance period starts (1–31)"),
        ("Payroll_SalaryPeriod_EndDay", "31", "Day of month salary attendance period ends (1–31); if less than start day, starts previous month"),
        (PayrollComponentMapping.OtComponentKey, PayrollComponentMapping.DefaultOtCode,
            "Compensation component code that receives imported overtime pay"),
        (PayrollComponentMapping.NopayComponentKey, PayrollComponentMapping.DefaultNopayCode,
            "Compensation component code for no-pay deduction (uses NOPAY_DAYS)"),
        (PayrollComponentMapping.PoyaComponentKey, PayrollComponentMapping.DefaultPoyaCode,
            "Compensation component code for Poya day pay (uses POYA_DAYS)"),
        (PayrollComponentMapping.BaseComponentKey, PayrollComponentMapping.DefaultBaseCode,
            "Base earning component used in OT / no-pay / Poya day-rate formulas"),
        (PayrollComponentMapping.WorkingHoursComponentKey, PayrollComponentMapping.DefaultWorkingHoursCode,
            "Optional component whose amount is monthly working hours (OT divisor); empty uses Payroll_OT_HourlyDivisor"),
    ];

    /// <summary>
    /// Ensures the full default payroll component catalog and rate settings exist (idempotent).
    /// Existing rows (including user-deleted catalog codes) are matched by Code so a second
    /// insert is not attempted. Deleted rows stay deleted.
    /// </summary>
    public static async Task EnsureAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var existing = await context.CompensationComponents
            .IgnoreQueryFilters()
            .ToListAsync(cancellationToken);

        foreach (var definition in DefaultComponents)
        {
            var match = FindExisting(existing, definition);
            if (match is not null)
            {
                if (!match.IsDeleted)
                    SyncCatalogMetadata(match, definition);
                continue;
            }

            var entity = ToEntity(definition);
            context.CompensationComponents.Add(entity);
            existing.Add(entity);
        }

        foreach (var component in existing.Where(c => !c.IsDeleted && PayrollPoyaComponent.IsMatch(c.Code, c.Name)))
        {
            // Keep formula metadata in sync only — never overwrite IsActive / taxable / EPF flags from the UI.
            component.FormulaExpression = PayrollPoyaComponent.FormulaExpression;
            component.DependsOnComponentCode = PayrollPoyaComponent.DependsOnComponentCode;
        }
        await EnsureDefaultSettingsAsync(context, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Idempotent EPF/ETF/OT rate rows in SystemSettings (all environments).</summary>
    public static async Task EnsureDefaultSettingsAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        foreach (var (key, value, description) in DefaultSystemSettings)
        {
            var existing = await context.SystemSettings.FindAsync([key], cancellationToken);
            if (existing is null)
            {
                context.SystemSettings.Add(new SystemSetting
                {
                    Key = key,
                    Value = value,
                    Description = description,
                });
                continue;
            }

            if (key == "Payroll_APIT_TaxMode" && IsLegacyApitTaxMode(existing.Value))
            {
                existing.Value = value;
                existing.Description = description;
            }
        }

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Older databases stored Exact, or nothing, as the company APIT mode.
    /// Salary withholding uses Monthly (IRD Table 01) unless Annual was chosen.
    /// </summary>
    private static bool IsLegacyApitTaxMode(string? value)
        => string.IsNullOrWhiteSpace(value)
            || string.Equals(value.Trim(), "Exact", StringComparison.OrdinalIgnoreCase);

    private static void SyncCatalogMetadata(CompensationComponent match, PayrollComponentDefinition definition)
    {
        if (definition.Category == ComponentCategory.Statutory)
        {
            match.IsStatutory = definition.IsStatutory;
            match.IsEmployerContribution = definition.IsEmployerContribution;
            if (!string.IsNullOrEmpty(definition.FormulaExpression))
                match.FormulaExpression = definition.FormulaExpression;
            if (!string.IsNullOrEmpty(definition.DependsOnComponentCode))
                match.DependsOnComponentCode = definition.DependsOnComponentCode;
            return;
        }

        if (match.Category != definition.Category)
            match.Category = definition.Category;
    }

    private static CompensationComponent? FindExisting(
        IReadOnlyCollection<CompensationComponent> existing,
        PayrollComponentDefinition definition)
    {
        var byCode = existing.FirstOrDefault(c =>
            c.Code.Equals(definition.Code, StringComparison.OrdinalIgnoreCase));
        if (byCode is not null)
            return byCode;

        if (definition.Code.Equals(PayrollPoyaComponent.DefaultCode, StringComparison.OrdinalIgnoreCase))
            return existing.FirstOrDefault(c => PayrollPoyaComponent.IsMatch(c.Code, c.Name));

        return null;
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
            IsEpfApplicable = definition.IsEpfApplicable,
            IsEtfApplicable = definition.IsEtfApplicable,
            IsStatutory = definition.IsStatutory,
            IsEmployerContribution = definition.IsEmployerContribution,
            FormulaExpression = definition.FormulaExpression,
            DependsOnComponentCode = definition.DependsOnComponentCode,
            IsActive = true,
        };
}
