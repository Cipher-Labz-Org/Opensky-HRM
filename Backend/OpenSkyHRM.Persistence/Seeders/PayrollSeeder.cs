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
                FormulaExpression = "TAXABLE_EARNINGS * EPF_EE_RATE",
                DependsOnComponentCode = "TAXABLE_EARNINGS"
            },

            // ── Statutory Contributions (Employer) ──────────────────
            new CompensationComponent
            {
                Name = "EPF - Employer 12%", Code = "EPF_ER",
                Type = ComponentType.StatutoryContribution, Category = ComponentCategory.Statutory,
                IsStatutory = true, IsTaxable = false, IsEmployerContribution = true, SortOrder = 910,
                Description = "Employee Provident Fund — employer contribution (12% of gross)",
                FormulaExpression = "TAXABLE_EARNINGS * EPF_ER_RATE",
                DependsOnComponentCode = "TAXABLE_EARNINGS"
            },
            new CompensationComponent
            {
                Name = "ETF - Employer 3%", Code = "ETF_ER",
                Type = ComponentType.StatutoryContribution, Category = ComponentCategory.Statutory,
                IsStatutory = true, IsTaxable = false, IsEmployerContribution = true, SortOrder = 920,
                Description = "Employee Trust Fund — employer contribution (3% of gross)",
                FormulaExpression = "TAXABLE_EARNINGS * ETF_RATE",
                DependsOnComponentCode = "TAXABLE_EARNINGS"
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

    /// <summary>
    /// Seeds fixed salary assignments for demo employees and a draft payroll batch so the
    /// Payroll Run flow can be exercised without manual data entry (development DBs only).
    /// </summary>
    public static async Task SeedDemoDataAsync(AppDbContext context)
    {
        if (await context.EmployeeCompensations.AnyAsync())
            return;

        var components = await context.CompensationComponents
            .Where(c => c.IsActive)
            .ToDictionaryAsync(c => c.Code, StringComparer.OrdinalIgnoreCase);

        if (components.Count == 0)
            return;

        var demoCodes = new[] { "EMP-0001", "EMP-0002", "EMP-001284" };
        var employees = await context.Employees
            .Where(e => demoCodes.Contains(e.EmployeeCode))
            .ToDictionaryAsync(e => e.EmployeeCode, StringComparer.OrdinalIgnoreCase);

        // Fresh dev DBs use OrganizationSeeder codes; customer DBs use real employee codes.
        List<Employee> targetEmployees;
        if (employees.Count > 0)
        {
            targetEmployees = employees.Values.ToList();
        }
        else
        {
            targetEmployees = await context.Employees
                .Where(e => e.Status != "Terminated")
                .OrderBy(e => e.EmployeeCode)
                .Take(5)
                .ToListAsync();
        }

        if (targetEmployees.Count == 0)
            return;

        var effectiveFrom = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var assignments = new List<EmployeeCompensation>();

        void Add(Employee emp, string compCode, decimal amount)
        {
            if (!components.TryGetValue(compCode, out var comp))
                return;

            assignments.Add(new EmployeeCompensation
            {
                EmployeeId = emp.Id,
                ComponentId = comp.Id,
                Amount = amount,
                Currency = "LKR",
                EffectiveFrom = effectiveFrom,
                IsActive = true,
            });
        }

        var salaryProfiles = new (decimal Basic, decimal Ta, decimal Housing, decimal Meal, decimal Loan)[]
        {
            (100_000m, 0m, 0m, 0m, 0m),
            (100_000m, 0m, 0m, 0m, 0m),
            (100_000m, 0m, 0m, 0m, 0m),
            (100_000m, 0m, 0m, 0m, 0m),
            (100_000m, 0m, 0m, 0m, 0m),
        };

        for (var i = 0; i < targetEmployees.Count; i++)
        {
            var emp = targetEmployees[i];
            var profile = salaryProfiles[Math.Min(i, salaryProfiles.Length - 1)];
            Add(emp, "BASIC", profile.Basic);
            Add(emp, "TA", profile.Ta);
            if (profile.Housing > 0) Add(emp, "HOUSING", profile.Housing);
            if (profile.Meal > 0) Add(emp, "MEAL", profile.Meal);
            if (profile.Loan > 0) Add(emp, "LOAN", profile.Loan);
        }

        if (assignments.Count == 0)
            return;

        context.EmployeeCompensations.AddRange(assignments);

        if (await context.PayrollBatches.AnyAsync())
            return;

        var now = DateTime.UtcNow;
        var employeeIds = targetEmployees.Select(e => e.Id).ToList();

        context.PayrollBatches.Add(new PayrollBatch
        {
            BatchCode = $"PR-{now.Year}-{now.Month:D2}-001",
            Month = now.Month,
            Year = now.Year,
            Status = BatchStatus.Draft,
            Notes = "Demo batch — select Calculate to generate pay slips",
            SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(employeeIds),
            EmployeeCount = employeeIds.Count,
        });
    }

    /// <summary>
    /// Keeps EPF/ETF formulas aligned with taxable earnings base (idempotent).
    /// </summary>
    public static async Task EnsureStatutoryFormulasAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var formulas = new Dictionary<string, (string Expression, string DependsOn)>(StringComparer.OrdinalIgnoreCase)
        {
            ["EPF_EE"] = ("TAXABLE_EARNINGS * EPF_EE_RATE", "TAXABLE_EARNINGS"),
            ["EPF_ER"] = ("TAXABLE_EARNINGS * EPF_ER_RATE", "TAXABLE_EARNINGS"),
            ["ETF_ER"] = ("TAXABLE_EARNINGS * ETF_RATE", "TAXABLE_EARNINGS"),
        };

        var statutory = await context.CompensationComponents
            .Where(c => formulas.Keys.Contains(c.Code))
            .ToListAsync(cancellationToken);

        foreach (var comp in statutory)
        {
            var (expression, dependsOn) = formulas[comp.Code];
            if (comp.FormulaExpression != expression)
                comp.FormulaExpression = expression;
            if (comp.DependsOnComponentCode != dependsOn)
                comp.DependsOnComponentCode = dependsOn;
        }
    }

    /// <summary>
    /// Development helper: sets BASIC to LKR 100,000 for the first 10 active employees so EPF/ETF
    /// preview uses a simple taxable base (100k → EPF 8k/12k, ETF 3k).
    /// </summary>
    public static async Task EnsureDemoSalary100kAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        if (!await context.EmployeeCompensations.AnyAsync(cancellationToken))
            return;

        var basic = await context.CompensationComponents
            .FirstOrDefaultAsync(c => c.Code == "BASIC" && c.IsActive, cancellationToken);
        if (basic is null)
            return;

        var earningCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "TA", "HOUSING", "MEAL", "COMM", "MEDICAL", "ATTEND", "BONUS", "FESTIVAL"
        };
        var earningComponents = await context.CompensationComponents
            .Where(c => c.IsActive && earningCodes.Contains(c.Code))
            .ToListAsync(cancellationToken);

        var employees = await context.Employees
            .Where(e => e.Status != "Terminated")
            .OrderBy(e => e.EmployeeCode)
            .Take(10)
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
            return;

        var employeeIds = employees.Select(e => e.Id).ToHashSet();
        var existing = await context.EmployeeCompensations
            .Where(ec => employeeIds.Contains(ec.EmployeeId) && ec.BatchId == null && ec.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var emp in employees)
        {
            var basicLine = existing.FirstOrDefault(ec =>
                ec.EmployeeId == emp.Id && ec.ComponentId == basic.Id);
            if (basicLine is null)
            {
                context.EmployeeCompensations.Add(new EmployeeCompensation
                {
                    EmployeeId = emp.Id,
                    ComponentId = basic.Id,
                    Amount = 100_000m,
                    Currency = "LKR",
                    EffectiveFrom = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    IsActive = true,
                });
            }
            else if (basicLine.Amount != 100_000m)
            {
                basicLine.Amount = 100_000m;
            }

            foreach (var comp in earningComponents)
            {
                var line = existing.FirstOrDefault(ec =>
                    ec.EmployeeId == emp.Id && ec.ComponentId == comp.Id);
                if (line is not null && line.Amount != 0)
                    line.Amount = 0;
            }
        }
    }
}
