using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

public static class PayrollSeeder
{
    public static Task SeedAsync(AppDbContext context) =>
        PayrollComponentSeeder.EnsureAsync(context);

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
    /// Keeps EPF/ETF on EPF/ETF-applicable earnings and APIT on taxable earnings (idempotent).
    /// TAXABLE_EARNINGS is reserved for APIT, not EPF/ETF.
    /// </summary>
    public static async Task EnsureStatutoryFormulasAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        var formulas = new Dictionary<string, (string Expression, string DependsOn)>(StringComparer.OrdinalIgnoreCase)
        {
            ["EPF_EE"] = ("EPF_EARNINGS * EPF_EE_RATE", "EPF_EARNINGS"),
            ["EPF_ER"] = ("EPF_EARNINGS * EPF_ER_RATE", "EPF_EARNINGS"),
            ["ETF_ER"] = ("ETF_EARNINGS * ETF_RATE", "ETF_EARNINGS"),
            ["APIT"] = ("APIT_AMOUNT", "TAXABLE_EARNINGS"),
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

        var leftover = await context.CompensationComponents
            .Where(c => c.FormulaExpression != null && c.FormulaExpression.Contains("TAXABLE_EARNINGS"))
            .ToListAsync(cancellationToken);

        foreach (var comp in leftover)
        {
            var formula = comp.FormulaExpression!;
            if (formula.Contains("EPF_EE_RATE", StringComparison.OrdinalIgnoreCase))
            {
                comp.FormulaExpression = formula.Replace("TAXABLE_EARNINGS", "EPF_EARNINGS", StringComparison.OrdinalIgnoreCase);
                if (string.Equals(comp.DependsOnComponentCode, "TAXABLE_EARNINGS", StringComparison.OrdinalIgnoreCase))
                    comp.DependsOnComponentCode = "EPF_EARNINGS";
            }
            else if (formula.Contains("EPF_ER_RATE", StringComparison.OrdinalIgnoreCase))
            {
                comp.FormulaExpression = formula.Replace("TAXABLE_EARNINGS", "EPF_EARNINGS", StringComparison.OrdinalIgnoreCase);
                if (string.Equals(comp.DependsOnComponentCode, "TAXABLE_EARNINGS", StringComparison.OrdinalIgnoreCase))
                    comp.DependsOnComponentCode = "EPF_EARNINGS";
            }
            else if (formula.Contains("ETF_RATE", StringComparison.OrdinalIgnoreCase))
            {
                comp.FormulaExpression = formula.Replace("TAXABLE_EARNINGS", "ETF_EARNINGS", StringComparison.OrdinalIgnoreCase);
                if (string.Equals(comp.DependsOnComponentCode, "TAXABLE_EARNINGS", StringComparison.OrdinalIgnoreCase))
                    comp.DependsOnComponentCode = "ETF_EARNINGS";
            }
        }
    }

    /// <summary>
    /// Development helper: sets BASIC to LKR 100,000 for the first 10 active employees so EPF/ETF
    /// preview uses a simple EPF/ETF base (100k → EPF 8k/12k, ETF 3k).
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
