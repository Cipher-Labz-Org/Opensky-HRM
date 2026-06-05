using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class PayrollCalculationEngine
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;

    public PayrollCalculationEngine(AppDbContext db, ISystemSettingService settings)
    {
        _db = db;
        _settings = settings;
    }

    public async Task<PayrollBatch> CalculateBatchAsync(Guid batchId)
    {
        var batch = await _db.PayrollBatches
            .FirstOrDefaultAsync(b => b.Id == batchId)
            ?? throw new InvalidOperationException("Batch not found.");

        if (batch.Status != BatchStatus.Draft && batch.Status != BatchStatus.Calculated)
            throw new InvalidOperationException($"Batch is in '{batch.Status}' status and cannot be recalculated.");

        // Parse selected employee IDs stored on the batch
        List<Guid>? selectedIds = null;
        if (!string.IsNullOrEmpty(batch.SelectedEmployeeIds))
        {
            try { selectedIds = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(batch.SelectedEmployeeIds); } catch { }
        }

        if (selectedIds is null || selectedIds.Count == 0)
            throw new InvalidOperationException("No employees selected for this batch. Please delete and create a new batch with employees selected.");

        // Bulk-delete previous lines then statements (bypasses change tracker to avoid concurrency issues)
        var oldStatementIds = await _db.PayStatements
            .IgnoreQueryFilters()
            .Where(s => s.BatchId == batchId)
            .Select(s => s.Id)
            .ToListAsync();

        if (oldStatementIds.Count > 0)
        {
            await _db.PayStatementLines
                .IgnoreQueryFilters()
                .Where(l => oldStatementIds.Contains(l.PayStatementId))
                .ExecuteDeleteAsync();

            await _db.PayStatements
                .IgnoreQueryFilters()
                .Where(s => s.BatchId == batchId)
                .ExecuteDeleteAsync();
        }

        var rates = await LoadRatesAsync();

        var components = await _db.CompensationComponents
            .Where(c => c.IsActive)
            .OrderBy(c => c.SortOrder)
            .ToListAsync();

        var activeEmployees = await _db.Employees
            .Where(e => e.Status != "Terminated" && selectedIds.Contains(e.Id))
            .ToListAsync();

        var employeeIdSet = activeEmployees.Select(e => e.Id).ToHashSet();
        var periodStart = batch.EffectiveFrom.Date;
        var periodEnd = (batch.EffectiveTo ?? batch.EffectiveFrom).Date;

        List<EmployeeCompensation> allCompensations;
        List<CompensationComponent> relevantComponents;
        var includeStatutory = batch.ProcessType == PayrollProcessType.Salary;

        switch (batch.ProcessType)
        {
            case PayrollProcessType.Salary:
            {
                var fixedCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == null && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.EffectiveFrom.Date <= periodEnd
                        && (ec.EffectiveTo == null || ec.EffectiveTo.Value.Date >= periodStart)
                        && (ec.Component.Category == ComponentCategory.Fixed || ec.Component.Category == ComponentCategory.Statutory))
                    .ToListAsync();

                var variableCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == batchId && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.Component.Category == ComponentCategory.Variable)
                    .ToListAsync();

                allCompensations = fixedCompensations.Concat(variableCompensations).ToList();
                relevantComponents = components
                    .Where(c => c.Category is ComponentCategory.Fixed or ComponentCategory.Variable or ComponentCategory.Statutory)
                    .ToList();
                break;
            }
            case PayrollProcessType.Bonus:
            {
                allCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == batchId && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.Component.Category == ComponentCategory.OneTime)
                    .ToListAsync();

                relevantComponents = components
                    .Where(c => c.Category == ComponentCategory.OneTime)
                    .ToList();
                break;
            }
            case PayrollProcessType.OtherTransactions:
            {
                allCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == batchId && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.Component.Category == ComponentCategory.Variable)
                    .ToListAsync();

                relevantComponents = components
                    .Where(c => c.Category == ComponentCategory.Variable)
                    .ToList();
                break;
            }
            default:
                throw new InvalidOperationException($"Unsupported process type '{batch.ProcessType}'.");
        }

        var newStatements = new List<PayStatement>();
        var attendanceSnapshots = await _db.PayrollBatchAttendanceSnapshots
            .Where(s => s.BatchId == batchId)
            .ToDictionaryAsync(s => s.EmployeeId);

        foreach (var employee in activeEmployees)
        {
            var empComp = allCompensations.Where(c => c.EmployeeId == employee.Id).ToList();
            attendanceSnapshots.TryGetValue(employee.Id, out var snapshot);

            // Allow employees with attendance snapshot (NOPAY) even if no other compensation yet
            if (empComp.Count == 0 && snapshot == null) continue;

            var statement = CalculateEmployeePayStatement(
                batch, employee, empComp, relevantComponents, rates, includeStatutory, snapshot);
            newStatements.Add(statement);
        }

        _db.PayStatements.AddRange(newStatements);

        batch.EmployeeCount = newStatements.Count;
        batch.TotalGross = newStatements.Sum(s => s.GrossPay);
        batch.TotalDeductions = newStatements.Sum(s => s.TotalDeductions);
        batch.TotalNet = newStatements.Sum(s => s.NetPay);
        batch.TotalEmployerCost = newStatements.Sum(s => s.EmployerCost);
        batch.Status = BatchStatus.Calculated;
        batch.ProcessedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return batch;
    }

    private PayStatement CalculateEmployeePayStatement(
        PayrollBatch batch, Employee employee,
        List<EmployeeCompensation> empComp,
        List<CompensationComponent> allComponents,
        PayrollRates rates,
        bool includeStatutory,
        PayrollBatchAttendanceSnapshot? attendanceSnapshot = null)
    {
        var resolvedValues = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        if (attendanceSnapshot != null)
        {
            resolvedValues["NOPAY_DAYS"] = attendanceSnapshot.TotalNopayDays;
            resolvedValues["OT_HOURS"] = attendanceSnapshot.ApprovedOtHours;
        }

        var lines = new List<PayStatementLine>();
        decimal taxableEarnings = 0;

        // Phase 1: Resolve fixed/variable earnings from employee compensation assignments
        foreach (var comp in allComponents.Where(c => c.Category != ComponentCategory.Statutory))
        {
            var assignment = empComp.FirstOrDefault(ec => ec.ComponentId == comp.Id);
            if (assignment is null && string.IsNullOrEmpty(comp.FormulaExpression)) continue;

            decimal amount;
            if (!string.IsNullOrEmpty(comp.FormulaExpression))
            {
                amount = EvaluateFormula(comp.FormulaExpression, resolvedValues, rates);
            }
            else
            {
                amount = assignment!.Amount;
            }

            resolvedValues[comp.Code] = amount;
            if (comp.Type == ComponentType.Earning && comp.IsTaxable)
                taxableEarnings += amount;

            lines.Add(new PayStatementLine
            {
                ComponentId = comp.Id,
                ComponentName = comp.Name,
                ComponentCode = comp.Code,
                Type = comp.Type.ToString(),
                Amount = amount,
                IsEmployerContribution = comp.IsEmployerContribution,
                SortOrder = comp.SortOrder,
            });
        }

        decimal totalEarnings = lines
            .Where(l => l.Type == ComponentType.Earning.ToString() && !l.IsEmployerContribution)
            .Sum(l => l.Amount);
        decimal totalNonStatDeductions = lines
            .Where(l => l.Type == ComponentType.Deduction.ToString() && !l.IsEmployerContribution)
            .Sum(l => l.Amount);

        resolvedValues["TOTAL_EARNINGS"] = totalEarnings;
        resolvedValues["GROSS"] = totalEarnings;
        resolvedValues["TAXABLE_EARNINGS"] = taxableEarnings;
        decimal basicPay = resolvedValues.GetValueOrDefault("BASIC", totalEarnings);
        resolvedValues["BASIC"] = basicPay;

        if (includeStatutory)
        {
            // Phase 2: Statutory — EPF/ETF base is taxable earnings (falls back to basic)
            var epfBase = taxableEarnings > 0 ? taxableEarnings : basicPay;
            decimal epfEmployee = Math.Round(epfBase * rates.EpfEmployeeRate, 2);
            decimal epfEmployer = Math.Round(epfBase * rates.EpfEmployerRate, 2);
            decimal etfEmployer = Math.Round(epfBase * rates.EtfEmployerRate, 2);

            // Statutory components from master list (formula-based)
            foreach (var comp in allComponents.Where(c => c.Category == ComponentCategory.Statutory))
            {
                decimal amount;
                if (!string.IsNullOrEmpty(comp.FormulaExpression))
                {
                    amount = EvaluateFormula(comp.FormulaExpression, resolvedValues, rates);
                }
                else
                {
                    amount = comp.Code.ToUpperInvariant() switch
                    {
                        "EPF_EE" => epfEmployee,
                        "EPF_ER" => epfEmployer,
                        "ETF_ER" => etfEmployer,
                        _ => 0
                    };
                }

                resolvedValues[comp.Code] = amount;

                lines.Add(new PayStatementLine
                {
                    ComponentId = comp.Id,
                    ComponentName = comp.Name,
                    ComponentCode = comp.Code,
                    Type = comp.Type.ToString(),
                    Amount = amount,
                    IsEmployerContribution = comp.IsEmployerContribution,
                    SortOrder = comp.SortOrder,
                });
            }

            // If no statutory components are defined in master, add EPF/ETF as standalone lines
            if (!allComponents.Any(c => c.Category == ComponentCategory.Statutory))
            {
                var dummyId = Guid.Empty;
                lines.Add(new PayStatementLine { ComponentId = dummyId, ComponentName = "EPF (Employee 8%)", ComponentCode = "EPF_EE", Type = "StatutoryDeduction", Amount = epfEmployee, SortOrder = 900 });
                lines.Add(new PayStatementLine { ComponentId = dummyId, ComponentName = "EPF (Employer 12%)", ComponentCode = "EPF_ER", Type = "StatutoryContribution", Amount = epfEmployer, IsEmployerContribution = true, SortOrder = 901 });
                lines.Add(new PayStatementLine { ComponentId = dummyId, ComponentName = "ETF (Employer 3%)", ComponentCode = "ETF_ER", Type = "StatutoryContribution", Amount = etfEmployer, IsEmployerContribution = true, SortOrder = 902 });
            }
        }

        decimal statutoryEmployeeDeductions = lines
            .Where(l => (l.Type == ComponentType.StatutoryDeduction.ToString()) && !l.IsEmployerContribution)
            .Sum(l => l.Amount);
        decimal employerContributions = lines
            .Where(l => l.IsEmployerContribution)
            .Sum(l => l.Amount);

        decimal grossPay = totalEarnings;
        decimal totalDeductions = totalNonStatDeductions + statutoryEmployeeDeductions;
        decimal netPay = grossPay - totalDeductions;

        return new PayStatement
        {
            BatchId = batch.Id,
            EmployeeId = employee.Id,
            Month = batch.Month,
            Year = batch.Year,
            BasicPay = basicPay,
            TotalEarnings = totalEarnings,
            TotalDeductions = totalDeductions,
            GrossPay = grossPay,
            NetPay = netPay,
            EmployerCost = grossPay + employerContributions,
            Lines = lines,
        };
    }

    /// <summary>
    /// Simple expression evaluator: supports component code references, arithmetic (+, -, *, /),
    /// and built-in rate variables (EPF_EE_RATE, EPF_ER_RATE, ETF_RATE).
    /// </summary>
    internal static decimal EvaluateFormula(string expression, Dictionary<string, decimal> values, PayrollRates rates)
    {
        var merged = new Dictionary<string, decimal>(values, StringComparer.OrdinalIgnoreCase)
        {
            ["EPF_EE_RATE"] = rates.EpfEmployeeRate,
            ["EPF_ER_RATE"] = rates.EpfEmployerRate,
            ["ETF_RATE"] = rates.EtfEmployerRate,
        };

        var resolved = Regex.Replace(expression, @"[A-Z_][A-Z0-9_]*", match =>
        {
            return merged.TryGetValue(match.Value, out var val)
                ? val.ToString(CultureInfo.InvariantCulture)
                : "0";
        }, RegexOptions.IgnoreCase);

        return EvaluateArithmetic(resolved);
    }

    /// <summary>
    /// Evaluates a simple arithmetic expression containing only numbers, +, -, *, /, (, ).
    /// Respects operator precedence. Returns 0 on any error.
    /// </summary>
    private static decimal EvaluateArithmetic(string expr)
    {
        try
        {
            var pos = 0;
            var result = ParseExpression(expr.Replace(" ", ""), ref pos);
            return Math.Round(result, 2);
        }
        catch
        {
            return 0;
        }
    }

    private static decimal ParseExpression(string expr, ref int pos)
    {
        var result = ParseTerm(expr, ref pos);
        while (pos < expr.Length && (expr[pos] == '+' || expr[pos] == '-'))
        {
            var op = expr[pos++];
            var term = ParseTerm(expr, ref pos);
            result = op == '+' ? result + term : result - term;
        }
        return result;
    }

    private static decimal ParseTerm(string expr, ref int pos)
    {
        var result = ParseFactor(expr, ref pos);
        while (pos < expr.Length && (expr[pos] == '*' || expr[pos] == '/'))
        {
            var op = expr[pos++];
            var factor = ParseFactor(expr, ref pos);
            result = op == '*' ? result * factor : (factor != 0 ? result / factor : 0);
        }
        return result;
    }

    private static decimal ParseFactor(string expr, ref int pos)
    {
        if (pos < expr.Length && expr[pos] == '(')
        {
            pos++;
            var result = ParseExpression(expr, ref pos);
            if (pos < expr.Length && expr[pos] == ')') pos++;
            return result;
        }

        bool negative = false;
        if (pos < expr.Length && expr[pos] == '-')
        {
            negative = true;
            pos++;
        }

        var start = pos;
        while (pos < expr.Length && (char.IsDigit(expr[pos]) || expr[pos] == '.'))
            pos++;

        var numStr = expr[start..pos];
        var value = decimal.TryParse(numStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var n) ? n : 0;
        return negative ? -value : value;
    }

    private async Task<PayrollRates> LoadRatesAsync()
    {
        return new PayrollRates
        {
            EpfEmployeeRate = decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployeeRate"), out var ee) ? ee : 0.08m,
            EpfEmployerRate = decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployerRate"), out var er) ? er : 0.12m,
            EtfEmployerRate = decimal.TryParse(await _settings.GetAsync("Payroll_ETF_EmployerRate"), out var etf) ? etf : 0.03m,
        };
    }
}

public class PayrollRates
{
    public decimal EpfEmployeeRate { get; set; } = 0.08m;
    public decimal EpfEmployerRate { get; set; } = 0.12m;
    public decimal EtfEmployerRate { get; set; } = 0.03m;
}
