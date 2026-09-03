using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.Payroll;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Seeders;

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

        if (batch.Status != BatchStatus.Draft
            && batch.Status != BatchStatus.Calculated
            && batch.Status != BatchStatus.Reviewed)
            throw new InvalidOperationException($"Batch is in '{batch.Status}' status and cannot be recalculated.");

        // Parse selected employee IDs stored on the batch
        List<Guid>? selectedIds = null;
        if (!string.IsNullOrEmpty(batch.SelectedEmployeeIds))
        {
            try { selectedIds = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(batch.SelectedEmployeeIds); } catch { }
        }

        if (selectedIds is null || selectedIds.Count == 0)
            throw new InvalidOperationException("No employees selected for this batch. Please delete and create a new batch with employees selected.");

        var alreadyPaid = await PayrollPeriodOccupancy.GetEmployeeIdsAsync(
            _db, batch.Year, batch.Month, batch.ProcessType, exceptBatchId: batch.Id);
        selectedIds = selectedIds.Where(id => !alreadyPaid.Contains(id)).Distinct().ToList();
        if (selectedIds.Count == 0)
            throw new InvalidOperationException(
                "Every selected employee already has a payroll for this month. Select only employees who are not in another batch for the same period.");

        await PayrollComponentSeeder.EnsureAsync(_db);
        await PayrollSeeder.EnsureStatutoryFormulasAsync(_db);

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
                // Employee Salary tab: all batchId-null rows except one-time bonuses.
                var fixedCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == null && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.Component.Category != ComponentCategory.OneTime)
                    .ToListAsync();

                var variableCompensations = await _db.EmployeeCompensations
                    .Include(ec => ec.Component)
                    .Where(ec => ec.IsActive && ec.BatchId == batchId && employeeIdSet.Contains(ec.EmployeeId)
                        && ec.Component.Category == ComponentCategory.Variable)
                    .ToListAsync();

                allCompensations = SelectAssignmentsForPeriod(fixedCompensations, periodStart, periodEnd)
                    .Concat(variableCompensations)
                    .ToList();
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
        var poyaDaysByEmp = includeStatutory
            ? await PayrollPoyaAttendance.GetDaysWorkedByEmployeeAsync(
                _db, employeeIdSet, periodStart, periodEnd)
            : new Dictionary<Guid, decimal>();
        var missingSalary = new List<string>();

        foreach (var employee in activeEmployees)
        {
            var empComp = allCompensations.Where(c => c.EmployeeId == employee.Id).ToList();
            attendanceSnapshots.TryGetValue(employee.Id, out var snapshot);

            if (empComp.Count == 0 && snapshot == null)
            {
                if (includeStatutory)
                {
                    var label = string.IsNullOrWhiteSpace(employee.EmployeeCode)
                        ? $"{employee.FirstName} {employee.LastName}".Trim()
                        : employee.EmployeeCode;
                    missingSalary.Add(label);
                }
                continue;
            }

            var poyaDays = poyaDaysByEmp.GetValueOrDefault(employee.Id);
            if (poyaDays <= 0)
                poyaDays = snapshot?.PoyaDaysWorked ?? 0;

            var statement = CalculateEmployeePayStatement(
                batch, employee, empComp, relevantComponents, rates, includeStatutory, snapshot, poyaDays);
            newStatements.Add(statement);
        }

        if (missingSalary.Count > 0)
            throw new InvalidOperationException(
                $"No salary found on the Employee Salary tab for: {string.Join(", ", missingSalary)}. Add their fixed salary, then calculate again.");

        if (newStatements.Count == 0)
            throw new InvalidOperationException(
                "No pay slips were generated. Add employee salary on the Employee Salary tab, then calculate again.");

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

        _db.PayStatements.AddRange(newStatements);

        batch.EmployeeCount = newStatements.Count;
        batch.TotalGross = newStatements.Sum(s => s.GrossPay);
        batch.TotalDeductions = newStatements.Sum(s => s.TotalDeductions);
        batch.TotalNet = newStatements.Sum(s => s.NetPay);
        batch.TotalEmployerCost = newStatements.Sum(s => s.EmployerCost);
        batch.Status = BatchStatus.Calculated;
        batch.ReviewedBy = null;
        batch.ReviewedAt = null;
        batch.ProcessedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return batch;
    }

    /// <summary>
    /// After fixed salary changes, refresh payslips on open salary batches that already ran Calculate.
    /// </summary>
    public async Task<int> TryRecalculateOpenSalaryBatchesForEmployeeAsync(Guid employeeId)
    {
        var batches = await _db.PayrollBatches
            .Where(b => b.ProcessType == PayrollProcessType.Salary
                && (b.Status == BatchStatus.Calculated
                    || b.Status == BatchStatus.Draft
                    || b.Status == BatchStatus.Reviewed))
            .Where(b => _db.PayStatements.Any(s => s.BatchId == b.Id))
            .ToListAsync();

        var recalculated = 0;
        foreach (var batch in batches)
        {
            List<Guid>? selectedIds = null;
            if (!string.IsNullOrEmpty(batch.SelectedEmployeeIds))
            {
                try { selectedIds = System.Text.Json.JsonSerializer.Deserialize<List<Guid>>(batch.SelectedEmployeeIds); }
                catch { /* ignore malformed JSON */ }
            }

            if (selectedIds?.Contains(employeeId) != true)
                continue;

            try
            {
                await CalculateBatchAsync(batch.Id);
                recalculated++;
            }
            catch (InvalidOperationException)
            {
                // Other employees in the batch may block a full recalc — salary save still succeeds.
            }
        }

        return recalculated;
    }

    /// <summary>
    /// Rebuilds every open salary batch from saved Employee Salary data (all employees in each batch).
    /// </summary>
    public async Task<(int Recalculated, IReadOnlyList<string> Errors)> TryRecalculateAllOpenSalaryBatchesAsync()
    {
        var batches = await _db.PayrollBatches
            .Where(b => b.ProcessType == PayrollProcessType.Salary
                && (b.Status == BatchStatus.Calculated
                    || b.Status == BatchStatus.Draft
                    || b.Status == BatchStatus.Reviewed))
            .OrderByDescending(b => b.Year)
            .ThenByDescending(b => b.Month)
            .ThenByDescending(b => b.CreatedAt)
            .ToListAsync();

        var recalculated = 0;
        var errors = new List<string>();
        foreach (var batch in batches)
        {
            try
            {
                await CalculateBatchAsync(batch.Id);
                recalculated++;
            }
            catch (InvalidOperationException ex)
            {
                errors.Add($"{batch.BatchCode}: {ex.Message}");
            }
        }

        return (recalculated, errors);
    }

    private PayStatement CalculateEmployeePayStatement(
        PayrollBatch batch, Employee employee,
        List<EmployeeCompensation> empComp,
        List<CompensationComponent> allComponents,
        PayrollRates rates,
        bool includeStatutory,
        PayrollBatchAttendanceSnapshot? attendanceSnapshot = null,
        decimal poyaDaysWorked = 0)
    {
        var resolvedValues = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        if (attendanceSnapshot != null)
        {
            resolvedValues["NOPAY_DAYS"] = attendanceSnapshot.TotalNopayDays;
            resolvedValues["OT_HOURS"] = attendanceSnapshot.ApprovedOtHours;
            if (poyaDaysWorked <= 0)
                poyaDaysWorked = attendanceSnapshot.PoyaDaysWorked;
        }

        var poyaAssignment = empComp.FirstOrDefault(ec =>
            PayrollPoyaComponent.IsMatch(ec.Component?.Code, ec.Component?.Name));
        resolvedValues["POYA_DAYS"] = PayrollPoyaComponent.ResolveDays(poyaAssignment?.Amount, poyaDaysWorked);

        var lines = new List<PayStatementLine>();
        decimal taxableEarnings = 0;
        decimal epfEarnings = 0;
        decimal etfEarnings = 0;

        // Phase 1: Resolve fixed/variable earnings from employee compensation assignments
        foreach (var comp in allComponents.Where(c => c.Category != ComponentCategory.Statutory))
        {
            var isPoya = PayrollPoyaComponent.IsMatch(comp.Code, comp.Name);
            var assignment = empComp.FirstOrDefault(ec => ec.ComponentId == comp.Id);
            if (assignment is null && string.IsNullOrEmpty(comp.FormulaExpression) && !isPoya) continue;

            decimal amount;
            if (isPoya && assignment != null && PayrollPoyaComponent.IsLumpSumPay(assignment.Amount))
            {
                amount = assignment.Amount;
            }
            else if (isPoya)
            {
                amount = EvaluateFormula(
                    string.IsNullOrEmpty(comp.FormulaExpression)
                        ? PayrollPoyaComponent.FormulaExpression
                        : comp.FormulaExpression,
                    resolvedValues, rates);
            }
            else if (assignment != null && comp.Category == ComponentCategory.Fixed)
            {
                // Fixed salary lines always use saved Employee Salary amounts (not formulas).
                amount = assignment.Amount;
            }
            else if (!string.IsNullOrEmpty(comp.FormulaExpression))
            {
                amount = EvaluateFormula(comp.FormulaExpression, resolvedValues, rates);
            }
            else
            {
                amount = assignment!.Amount;
            }

            resolvedValues[comp.Code] = amount;
            if (IsBasicComponentCode(comp.Code))
                resolvedValues["BASIC"] = amount;
            if (comp.Type == ComponentType.Earning && comp.IsTaxable)
                taxableEarnings += amount;
            if (comp.Type == ComponentType.Earning && comp.IsEpfApplicable)
                epfEarnings += amount;
            if (comp.Type == ComponentType.Earning && comp.IsEtfApplicable)
                etfEarnings += amount;

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

        // Include fixed salary assignments even when the catalog row is inactive or miscategorized.
        var processedComponentIds = lines.Select(l => l.ComponentId).ToHashSet();
        foreach (var assignment in empComp.Where(ec => ec.Component.Category != ComponentCategory.Statutory))
        {
            if (processedComponentIds.Contains(assignment.ComponentId))
                continue;

            var comp = assignment.Component;
            var isPoya = PayrollPoyaComponent.IsMatch(comp.Code, comp.Name);
            if (isPoya)
                continue;

            var amount = assignment.Amount;
            resolvedValues[comp.Code] = amount;
            if (IsBasicComponentCode(comp.Code))
                resolvedValues["BASIC"] = amount;
            if (comp.Type == ComponentType.Earning && comp.IsTaxable)
                taxableEarnings += amount;
            if (comp.Type == ComponentType.Earning && comp.IsEpfApplicable)
                epfEarnings += amount;
            if (comp.Type == ComponentType.Earning && comp.IsEtfApplicable)
                etfEarnings += amount;

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
            processedComponentIds.Add(assignment.ComponentId);
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
        decimal basicPay = ResolveBasicPay(resolvedValues, empComp, totalEarnings);
        resolvedValues["BASIC"] = basicPay;
        var (epfBase, etfBase) = ResolveStatutoryBases(epfEarnings, etfEarnings, basicPay);
        resolvedValues["EPF_EARNINGS"] = epfBase;
        resolvedValues["ETF_EARNINGS"] = etfBase;
        decimal apitAmount = CalculateApitTable01(taxableEarnings);
        resolvedValues["APIT_AMOUNT"] = apitAmount;
        resolvedValues["APIT"] = apitAmount;

        if (includeStatutory)
        {
            // Phase 2: EPF/ETF use applicable-earnings bases; APIT uses taxable earnings (IRD Table 01)
            decimal epfEmployee = Math.Round(epfBase * rates.EpfEmployeeRate, 2);
            decimal epfEmployer = Math.Round(epfBase * rates.EpfEmployerRate, 2);
            decimal etfEmployer = Math.Round(etfBase * rates.EtfEmployerRate, 2);

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
                        "APIT" => apitAmount,
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
    /// Picks one assignment per employee/component for the batch period. When no row overlaps the
    /// period (e.g. salary entered after the pay month), falls back to the latest active assignment.
    /// </summary>
    internal static List<EmployeeCompensation> SelectAssignmentsForPeriod(
        IEnumerable<EmployeeCompensation> assignments,
        DateTime periodStart,
        DateTime periodEnd)
    {
        return assignments
            .GroupBy(ec => new { ec.EmployeeId, ec.ComponentId })
            .Select(g =>
            {
                var overlapping = g
                    .Where(ec =>
                        ec.EffectiveFrom.Date <= periodEnd &&
                        (ec.EffectiveTo == null || ec.EffectiveTo.Value.Date >= periodStart))
                    .OrderByDescending(ec => ec.EffectiveFrom)
                    .FirstOrDefault();

                return overlapping ?? g.OrderByDescending(ec => ec.EffectiveFrom).First();
            })
            .ToList();
    }

    /// <summary>
    /// Resolves basic pay from BASIC or BASIC* component codes (e.g. BASIC1).
    /// </summary>
    /// <summary>
    /// EPF/ETF statutory bases. When ETF-applicable earnings are unset, reuse the EPF base
    /// (then basic pay) so employer ETF is not dropped after a component is marked EPF-only.
    /// </summary>
    internal static (decimal EpfBase, decimal EtfBase) ResolveStatutoryBases(
        decimal epfEarnings, decimal etfEarnings, decimal basicPay)
    {
        var epfBase = epfEarnings > 0 ? epfEarnings : basicPay;
        var etfBase = etfEarnings > 0 ? etfEarnings : epfEarnings > 0 ? epfEarnings : basicPay;
        return (epfBase, etfBase);
    }

    internal static decimal NormalizePayrollRate(decimal rate) => rate > 1m ? rate / 100m : rate;

    internal static decimal ResolveBasicPay(
        Dictionary<string, decimal> resolvedValues,
        List<EmployeeCompensation> empComp,
        decimal totalEarnings)
    {
        if (resolvedValues.TryGetValue("BASIC", out var basic) && basic > 0)
            return basic;

        var basicAlias = resolvedValues
            .Where(kv => kv.Key.StartsWith("BASIC", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(kv.Key, "BASIC", StringComparison.OrdinalIgnoreCase))
            .Select(kv => kv.Value)
            .FirstOrDefault(v => v > 0);
        if (basicAlias > 0)
            return basicAlias;

        var basicAssignment = empComp.FirstOrDefault(ec =>
            ec.Component.Code.Equals("BASIC", StringComparison.OrdinalIgnoreCase)
            || ec.Component.Code.StartsWith("BASIC", StringComparison.OrdinalIgnoreCase));
        if (basicAssignment is { Amount: > 0 })
            return basicAssignment.Amount;

        return totalEarnings;
    }

    private static bool IsBasicComponentCode(string code) =>
        code.Equals("BASIC", StringComparison.OrdinalIgnoreCase)
        || code.StartsWith("BASIC", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// IRD Tax Table 01 (Y/A 2025/26) — monthly APIT on regular taxable profits.
    /// </summary>
    internal static decimal CalculateApitTable01(decimal taxableEarnings)
    {
        if (taxableEarnings <= 150_000m)
            return 0;
        if (taxableEarnings <= 233_333m)
            return Math.Round(taxableEarnings * 0.06m - 9_000m, 2);
        if (taxableEarnings <= 275_000m)
            return Math.Round(taxableEarnings * 0.18m - 37_000m, 2);
        if (taxableEarnings <= 316_667m)
            return Math.Round(taxableEarnings * 0.24m - 53_500m, 2);
        if (taxableEarnings <= 358_333m)
            return Math.Round(taxableEarnings * 0.30m - 72_500m, 2);
        return Math.Max(0, Math.Round(taxableEarnings * 0.36m - 94_000m, 2));
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
            EpfEmployeeRate = NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployeeRate"), out var ee) ? ee : 0.08m),
            EpfEmployerRate = NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_EPF_EmployerRate"), out var er) ? er : 0.12m),
            EtfEmployerRate = NormalizePayrollRate(
                decimal.TryParse(await _settings.GetAsync("Payroll_ETF_EmployerRate"), out var etf) ? etf : 0.03m),
        };
    }
}

public class PayrollRates
{
    public decimal EpfEmployeeRate { get; set; } = 0.08m;
    public decimal EpfEmployerRate { get; set; } = 0.12m;
    public decimal EtfEmployerRate { get; set; } = 0.03m;
}
