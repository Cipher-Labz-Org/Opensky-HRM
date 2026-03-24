using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

public static class PayrollSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.CompensationComponents.AnyAsync()) return;

        var components = new[]
        {
            // ── Fixed Earnings ──────────────────────────────────────
            new CompensationComponent
            {
                Name = "Basic Salary", Code = "BASIC",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = true, SortOrder = 10,
                Description = "Monthly basic salary"
            },
            new CompensationComponent
            {
                Name = "Transport Allowance", Code = "TA",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = true, SortOrder = 20,
                Description = "Monthly transport / travel allowance"
            },
            new CompensationComponent
            {
                Name = "Meal Allowance", Code = "MEAL",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = false, SortOrder = 30,
                Description = "Daily meal / food allowance"
            },
            new CompensationComponent
            {
                Name = "Housing Allowance", Code = "HOUSING",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = true, SortOrder = 40,
                Description = "Monthly housing / rent allowance"
            },
            new CompensationComponent
            {
                Name = "Communication Allowance", Code = "COMM",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = false, SortOrder = 50,
                Description = "Phone and internet allowance"
            },
            new CompensationComponent
            {
                Name = "Medical Allowance", Code = "MEDICAL",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = false, SortOrder = 60,
                Description = "Monthly medical / health allowance"
            },
            new CompensationComponent
            {
                Name = "Attendance Allowance", Code = "ATTEND",
                Type = ComponentType.Earning, Category = ComponentCategory.Fixed,
                IsTaxable = true, SortOrder = 70,
                Description = "Allowance for full attendance in the month"
            },

            // ── Variable Earnings ───────────────────────────────────
            new CompensationComponent
            {
                Name = "Overtime", Code = "OT",
                Type = ComponentType.Earning, Category = ComponentCategory.Variable,
                IsTaxable = true, SortOrder = 100,
                Description = "Overtime pay for additional hours worked"
            },
            new CompensationComponent
            {
                Name = "Commission", Code = "COMMISSION",
                Type = ComponentType.Earning, Category = ComponentCategory.Variable,
                IsTaxable = true, SortOrder = 110,
                Description = "Sales commission or performance-based pay"
            },
            new CompensationComponent
            {
                Name = "Incentive", Code = "INCENTIVE",
                Type = ComponentType.Earning, Category = ComponentCategory.Variable,
                IsTaxable = true, SortOrder = 120,
                Description = "Performance incentive payment"
            },

            // ── One-Time Earnings ───────────────────────────────────
            new CompensationComponent
            {
                Name = "Bonus", Code = "BONUS",
                Type = ComponentType.Earning, Category = ComponentCategory.OneTime,
                IsTaxable = true, SortOrder = 200,
                Description = "Annual or special bonus payment"
            },
            new CompensationComponent
            {
                Name = "Festival Advance", Code = "FESTIVAL",
                Type = ComponentType.Earning, Category = ComponentCategory.OneTime,
                IsTaxable = false, SortOrder = 210,
                Description = "Festival advance (Sinhala/Tamil New Year, Vesak, etc.)"
            },

            // ── Deductions ──────────────────────────────────────────
            new CompensationComponent
            {
                Name = "Loan Deduction", Code = "LOAN",
                Type = ComponentType.Deduction, Category = ComponentCategory.Fixed,
                SortOrder = 300,
                Description = "Monthly loan / advance repayment deduction"
            },
            new CompensationComponent
            {
                Name = "No-Pay Deduction", Code = "NOPAY",
                Type = ComponentType.Deduction, Category = ComponentCategory.Variable,
                SortOrder = 310,
                Description = "Deduction for no-pay leave days",
                FormulaExpression = "BASIC / 30 * NOPAY_DAYS",
                DependsOnComponentCode = "BASIC"
            },
            new CompensationComponent
            {
                Name = "Salary Advance", Code = "ADVANCE",
                Type = ComponentType.Deduction, Category = ComponentCategory.Variable,
                SortOrder = 320,
                Description = "Salary advance recovery"
            },
            new CompensationComponent
            {
                Name = "Insurance Premium", Code = "INSURANCE",
                Type = ComponentType.Deduction, Category = ComponentCategory.Fixed,
                SortOrder = 330,
                Description = "Employee insurance premium deduction"
            },

            // ── Statutory Deductions (Employee) ─────────────────────
            new CompensationComponent
            {
                Name = "EPF - Employee 8%", Code = "EPF_EE",
                Type = ComponentType.StatutoryDeduction, Category = ComponentCategory.Statutory,
                IsStatutory = true, IsTaxable = false, SortOrder = 900,
                Description = "Employee Provident Fund — employee contribution (8% of gross)",
                FormulaExpression = "BASIC * EPF_EE_RATE",
                DependsOnComponentCode = "BASIC"
            },

            // ── Statutory Contributions (Employer) ──────────────────
            new CompensationComponent
            {
                Name = "EPF - Employer 12%", Code = "EPF_ER",
                Type = ComponentType.StatutoryContribution, Category = ComponentCategory.Statutory,
                IsStatutory = true, IsTaxable = false, IsEmployerContribution = true, SortOrder = 910,
                Description = "Employee Provident Fund — employer contribution (12% of gross)",
                FormulaExpression = "BASIC * EPF_ER_RATE",
                DependsOnComponentCode = "BASIC"
            },
            new CompensationComponent
            {
                Name = "ETF - Employer 3%", Code = "ETF_ER",
                Type = ComponentType.StatutoryContribution, Category = ComponentCategory.Statutory,
                IsStatutory = true, IsTaxable = false, IsEmployerContribution = true, SortOrder = 920,
                Description = "Employee Trust Fund — employer contribution (3% of gross)",
                FormulaExpression = "BASIC * ETF_RATE",
                DependsOnComponentCode = "BASIC"
            },
        };

        context.CompensationComponents.AddRange(components);

        // Seed default EPF/ETF rates into SystemSettings if not present
        var epfEeKey = await context.SystemSettings.FindAsync("Payroll_EPF_EmployeeRate");
        if (epfEeKey is null)
            context.SystemSettings.Add(new SystemSetting { Key = "Payroll_EPF_EmployeeRate", Value = "0.08", Description = "EPF employee contribution rate" });

        var epfErKey = await context.SystemSettings.FindAsync("Payroll_EPF_EmployerRate");
        if (epfErKey is null)
            context.SystemSettings.Add(new SystemSetting { Key = "Payroll_EPF_EmployerRate", Value = "0.12", Description = "EPF employer contribution rate" });

        var etfErKey = await context.SystemSettings.FindAsync("Payroll_ETF_EmployerRate");
        if (etfErKey is null)
            context.SystemSettings.Add(new SystemSetting { Key = "Payroll_ETF_EmployerRate", Value = "0.03", Description = "ETF employer contribution rate" });
    }
}
