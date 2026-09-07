using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Persistence.Seeders;

public static class PayrollSeeder
{
    public static Task SeedAsync(AppDbContext context) =>
        PayrollComponentSeeder.EnsureAsync(context);

    /// <summary>
    /// Seeds fixed salary assignments for demo employees (development DBs only).
    /// </summary>
    public static async Task SeedDemoDataAsync(AppDbContext context)
    {
        await SeedDemoCompensationsAsync(context);
        await EnsureStarterBatchAsync(context);
    }

    /// <summary>
    /// Ensures a draft salary batch exists when the tenant has none. Runs in all environments
    /// so production sites (e.g. Stage Cafe) recover after customer reset or first go-live.
    /// </summary>
    public static async Task EnsureStarterBatchAsync(AppDbContext context, CancellationToken cancellationToken = default)
    {
        if (await context.PayrollBatches.AnyAsync(cancellationToken))
            return;

        var employees = await context.Employees
            .AsNoTracking()
            .Where(e => e.Status != "Terminated")
            .OrderBy(e => e.EmployeeCode)
            .Select(e => new { e.Id, e.EmployeeCode })
            .ToListAsync(cancellationToken);

        if (employees.Count == 0)
            return;

        var employeeIdsWithSalary = await context.EmployeeCompensations
            .AsNoTracking()
            .Where(ec => ec.IsActive && ec.BatchId == null)
            .Select(ec => ec.EmployeeId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var salarySet = employeeIdsWithSalary.ToHashSet();
        var selectedIds = employees
            .Where(e => salarySet.Contains(e.Id))
            .Select(e => e.Id)
            .ToList();

        // No fixed salary yet — still create a batch with all active staff so Payroll Run is usable.
        if (selectedIds.Count == 0)
            selectedIds = employees.Select(e => e.Id).ToList();

        var now = DateTime.UtcNow;
        var year = now.Year;
        var month = now.Month;
        var effectiveFrom = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var effectiveTo = effectiveFrom.AddMonths(1).AddDays(-1);

        var existingCodes = await context.PayrollBatches
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(b => b.Year == year && b.Month == month && b.ProcessType == PayrollProcessType.Salary)
            .Select(b => b.BatchCode)
            .ToListAsync(cancellationToken);

        var sequence = existingCodes.Count + 1;
        while (existingCodes.Contains($"SAL-{year}-{month:D2}-{sequence:D3}", StringComparer.OrdinalIgnoreCase))
            sequence++;

        context.PayrollBatches.Add(new PayrollBatch
        {
            BatchCode = $"SAL-{year}-{month:D2}-{sequence:D3}",
            Month = month,
            Year = year,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
            ProcessType = PayrollProcessType.Salary,
            Status = BatchStatus.Draft,
            Notes = selectedIds.Count == employees.Count
                ? "Auto-created starter batch — assign salary on Employee Salary, then Calculate"
                : "Auto-created starter batch — includes employees with fixed salary; add others on Employee Salary, then Calculate",
            SelectedEmployeeIds = System.Text.Json.JsonSerializer.Serialize(selectedIds),
            EmployeeCount = selectedIds.Count,
        });

        await context.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedDemoCompensationsAsync(AppDbContext context)
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
        await context.SaveChangesAsync();
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

        if (context.ChangeTracker.HasChanges())
            await context.SaveChangesAsync(cancellationToken);
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
