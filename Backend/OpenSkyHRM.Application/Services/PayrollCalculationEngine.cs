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

    public async Task<PayrollBatch> CalculateBatchAsync(Guid batchId, bool preserveApproval = false)
    {
        var batch = await _db.PayrollBatches
            .FirstOrDefaultAsync(b => b.Id == batchId)
            ?? throw new InvalidOperationException("Batch not found.");

        var previousStatus = batch.Status;
        var keepApproved = preserveApproval
            && (previousStatus == BatchStatus.Approved || previousStatus == BatchStatus.Finalized);

        if (!keepApproved
            && batch.Status != BatchStatus.Draft
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
        var includeApit = includeStatutory || batch.ProcessType == PayrollProcessType.Bonus;

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
                    .Where(c => c.Category == ComponentCategory.OneTime
                        || (c.Category == ComponentCategory.Statutory && IsApitComponent(c)))
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
        var missingBonus = new List<string>();
        var priorYtdByEmployee = includeApit
            ? await LoadConfirmedApitYtdAsync(employeeIdSet, batch.Year, batch.Month, batch.Id)
            : new Dictionary<Guid, ConfirmedApitYtd>();
        var monthlySalaryByEmployee = batch.ProcessType == PayrollProcessType.Bonus
            ? await LoadMonthlySalaryAsync(employeeIdSet, periodStart, periodEnd)
            : new Dictionary<Guid, decimal>();

        foreach (var employee in activeEmployees)
        {
            var empComp = allCompensations.Where(c => c.EmployeeId == employee.Id).ToList();
            attendanceSnapshots.TryGetValue(employee.Id, out var snapshot);

            if (empComp.Count == 0 && snapshot == null)
            {
                var label = string.IsNullOrWhiteSpace(employee.EmployeeCode)
                    ? $"{employee.FirstName} {employee.LastName}".Trim()
                    : employee.EmployeeCode;
                if (includeStatutory)
                    missingSalary.Add(label);
                else if (batch.ProcessType == PayrollProcessType.Bonus)
                    missingBonus.Add(label);
                continue;
            }

            var poyaDays = poyaDaysByEmp.GetValueOrDefault(employee.Id);
            if (poyaDays <= 0)
                poyaDays = snapshot?.PoyaDaysWorked ?? 0;

            var employeeMode = NormalizeApitTaxMode(
                string.IsNullOrWhiteSpace(employee.ApitTaxMode) ? rates.ApitTaxMode : employee.ApitTaxMode);
            priorYtdByEmployee.TryGetValue(employee.Id, out var priorYtd);
            monthlySalaryByEmployee.TryGetValue(employee.Id, out var monthlySalary);

            var statement = CalculateEmployeePayStatement(
                batch, employee, empComp, relevantComponents, rates, includeStatutory, snapshot, poyaDays,
                employeeMode, priorYtd.TotalTaxable, priorYtd.SalaryMonths,
                includeApit, monthlySalary, priorYtd);
            newStatements.Add(statement);
        }

        if (missingSalary.Count > 0)
            throw new InvalidOperationException(
                $"No salary found on the Employee Salary tab for: {string.Join(", ", missingSalary)}. Add their fixed salary, then calculate again.");
        if (missingBonus.Count > 0)
            throw new InvalidOperationException(
                $"No bonus amount found for: {string.Join(", ", missingBonus)}. Enter the bonus on Variable Entry, then calculate again.");

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
        if (keepApproved)
        {
            batch.Status = previousStatus;
            foreach (var statement in newStatements)
                statement.Status = PayStatementStatus.Finalized;
        }
        else
        {
            batch.Status = BatchStatus.Calculated;
            batch.ReviewedBy = null;
            batch.ReviewedAt = null;
        }
        batch.ProcessedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        if (keepApproved && includeApit)
        {
            await RebuildEmployeeApitYearBalancesAsync(
                employeeIdSet, ApitTaxYearStartYear(batch.Month, batch.Year));
        }

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
                    || b.Status == BatchStatus.Reviewed
                    || b.Status == BatchStatus.Approved
                    || b.Status == BatchStatus.Finalized))
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
                await CalculateBatchAsync(batch.Id, preserveApproval: true);
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
        decimal poyaDaysWorked = 0,
        string? employeeTaxMode = null,
        decimal priorCumulativeTaxable = 0,
        int confirmedMonths = 0,
        bool includeApit = false,
        decimal bonusRegularSalary = 0,
        ConfirmedApitYtd priorYtd = default)
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
        decimal taxableRegular = 0;
        decimal taxableLump = 0;
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
            AccumulateEarningsBases(comp, amount, ref taxableRegular, ref taxableLump, ref epfEarnings, ref etfEarnings);

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
            AccumulateEarningsBases(comp, amount, ref taxableRegular, ref taxableLump, ref epfEarnings, ref etfEarnings);

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
        decimal basicPay = ResolveBasicPay(resolvedValues, empComp, totalEarnings);
        resolvedValues["BASIC"] = basicPay;
        var (epfBase, etfBase) = ResolveStatutoryBases(epfEarnings, etfEarnings, basicPay);
        resolvedValues["EPF_EARNINGS"] = epfBase;
        resolvedValues["ETF_EARNINGS"] = etfBase;
        var isBonusBatch = batch.ProcessType == PayrollProcessType.Bonus;
        var regularSalary = isBonusBatch
            ? Math.Max(0, bonusRegularSalary)
            : ResolveApitRegularBase(
                Math.Max(0, totalEarnings - taxableLump), taxableRegular, epfBase, basicPay);
        if (isBonusBatch && taxableLump <= 0)
            taxableLump = Math.Max(0, totalEarnings);
        resolvedValues["TAXABLE_EARNINGS"] = regularSalary;
        resolvedValues["LUMP_TAXABLE"] = taxableLump;
        var thisMonthTaxable = isBonusBatch
            ? Math.Round(taxableLump, 2)
            : Math.Round(regularSalary + taxableLump, 2);
        var taxMode = NormalizeApitTaxMode(employeeTaxMode ?? rates.ApitTaxMode);
        decimal apitAmount = isBonusBatch
            ? CalculateBonusApitByMode(regularSalary, taxableLump, taxMode, priorYtd)
            : CalculateApitByMode(
                regularSalary, taxableLump, batch.Month, taxMode, priorCumulativeTaxable, confirmedMonths);
        resolvedValues["APIT_AMOUNT"] = apitAmount;
        resolvedValues["APIT"] = apitAmount;

        if (includeStatutory || includeApit)
        {
            // Phase 2: EPF/ETF use applicable-earnings bases; APIT uses Table 01 + Table 02
            decimal epfEmployee = Math.Round(epfBase * rates.EpfEmployeeRate, 2);
            decimal epfEmployer = Math.Round(epfBase * rates.EpfEmployerRate, 2);
            decimal etfEmployer = Math.Round(etfBase * rates.EtfEmployerRate, 2);

            // Statutory components from master list (formula-based)
            foreach (var comp in allComponents.Where(c => c.Category == ComponentCategory.Statutory))
            {
                if (!includeStatutory && !IsApitComponent(comp))
                    continue;
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
            ApitTaxable = thisMonthTaxable,
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

    /// <summary>
    /// Monthly regular profits for APIT Table 01. When no earning is marked Taxable
    /// (common on live after a partial migration), fall back to the EPF base then basic pay.
    /// </summary>
    internal static decimal ResolveTaxableBase(decimal taxableRegular, decimal epfBase, decimal basicPay)
    {
        if (taxableRegular > 0)
            return taxableRegular;
        if (epfBase > 0)
            return epfBase;
        return basicPay;
    }

    /// <summary>
    /// APIT base is the employee's monthly salary (all regular earnings). Falls back to
    /// taxable / EPF / basic so every employee is assessed, not only Taxable-marked lines.
    /// </summary>
    internal static decimal ResolveApitRegularBase(
        decimal regularEarnings, decimal taxableRegular, decimal epfBase, decimal basicPay)
    {
        if (regularEarnings > 0)
            return regularEarnings;
        return ResolveTaxableBase(taxableRegular, epfBase, basicPay);
    }

    private static void AccumulateEarningsBases(
        CompensationComponent comp,
        decimal amount,
        ref decimal taxableRegular,
        ref decimal taxableLump,
        ref decimal epfEarnings,
        ref decimal etfEarnings)
    {
        if (comp.Type != ComponentType.Earning || comp.IsEmployerContribution)
            return;

        if (comp.IsTaxable)
        {
            if (comp.Category == ComponentCategory.OneTime)
                taxableLump += amount;
            else
                taxableRegular += amount;
        }

        if (comp.IsEpfApplicable)
            epfEarnings += amount;
        if (comp.IsEtfApplicable)
            etfEarnings += amount;
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
    /// IRD annual APIT table (Y/A 2025/26) on the year's total profits — not monthly tax × 12.
    /// </summary>
    internal static decimal CalculateApitTableAnnual(decimal yearlyProfits)
    {
        if (yearlyProfits <= 1_800_000m)
            return 0;
        if (yearlyProfits <= 2_800_000m)
            return Math.Round(yearlyProfits * 0.06m - 108_000m, 2);
        if (yearlyProfits <= 3_300_000m)
            return Math.Round(yearlyProfits * 0.18m - 444_000m, 2);
        if (yearlyProfits <= 3_800_000m)
            return Math.Round(yearlyProfits * 0.24m - 642_000m, 2);
        if (yearlyProfits <= 4_300_000m)
            return Math.Round(yearlyProfits * 0.30m - 870_000m, 2);
        return Math.Max(0, Math.Round(yearlyProfits * 0.36m - 1_128_000m, 2));
    }

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
    /// Total monthly APIT: Table 01 on regular profits plus Table 02 on lump sums
    /// (tax on regular+lump minus tax on regular).
    /// </summary>
    internal static decimal CalculateApit(decimal regularTaxable, decimal lumpTaxable = 0)
    {
        var table01 = CalculateApitTable01(regularTaxable);
        if (lumpTaxable <= 0)
            return table01;

        var combined = CalculateApitTable01(regularTaxable + lumpTaxable);
        var table02 = Math.Max(0, combined - table01);
        return Math.Round(table01 + table02, 2);
    }

    /// <summary>
    /// Tax year starts 1 March: March = 1, April = 2, … February = 12.
    /// </summary>
    internal static int ApitTaxYearMonthNumber(int calendarMonth)
    {
        if (calendarMonth is < 1 or > 12)
            throw new ArgumentOutOfRangeException(nameof(calendarMonth));
        return calendarMonth >= 3 ? calendarMonth - 2 : calendarMonth + 10;
    }

    /// <summary>
    /// Calendar year that contains 1 March of the year of assessment for this pay month.
    /// </summary>
    internal static int ApitTaxYearStartYear(int calendarMonth, int calendarYear)
    {
        if (calendarMonth is < 1 or > 12)
            throw new ArgumentOutOfRangeException(nameof(calendarMonth));
        return calendarMonth >= 3 ? calendarYear : calendarYear - 1;
    }

    internal static bool IsInApitTaxYear(int calendarMonth, int calendarYear, int taxYearStartYear)
        => ApitTaxYearStartYear(calendarMonth, calendarYear) == taxYearStartYear;

    internal static decimal StatementApitTaxable(decimal apitTaxable, decimal totalEarnings)
        => apitTaxable > 0 ? apitTaxable : Math.Max(0, totalEarnings);

    /// <summary>
    /// This month's Annual APIT: tax on the new YTD minus tax on the confirmed prior YTD.
    /// </summary>
    internal static decimal CalculateAnnualApitIncrement(
        decimal priorCumulativeTaxable, decimal thisMonthTaxable)
    {
        var prior = Math.Max(0, priorCumulativeTaxable);
        var added = Math.Max(0, thisMonthTaxable);
        var before = CalculateApitTableAnnual(prior);
        var after = CalculateApitTableAnnual(prior + added);
        return Math.Max(0, Math.Round(after - before, 2));
    }

    /// <summary>
    /// Year-to-date APIT: one month's table amount times the tax-year month number.
    /// March = monthly rate, April = 2×, and so on through February.
    /// </summary>
    internal static decimal CalculateCumulativeApit(
        decimal regularTaxable, decimal lumpTaxable, int calendarMonth)
    {
        var monthly = CalculateApit(regularTaxable, lumpTaxable);
        return Math.Round(monthly * ApitTaxYearMonthNumber(calendarMonth), 2);
    }

    internal const string ApitTaxModeMonthly = "Monthly";
    internal const string ApitTaxModeAnnual = "Annual";
    internal const string ApitTaxModeExact = "Exact";

    internal static string NormalizeApitTaxMode(string? mode)
    {
        if (string.Equals(mode, ApitTaxModeMonthly, StringComparison.OrdinalIgnoreCase))
            return ApitTaxModeMonthly;
        if (string.Equals(mode, ApitTaxModeAnnual, StringComparison.OrdinalIgnoreCase)
            || string.Equals(mode, "Annualy", StringComparison.OrdinalIgnoreCase)
            || string.Equals(mode, "Annually", StringComparison.OrdinalIgnoreCase))
            return ApitTaxModeAnnual;
        return ApitTaxModeExact;
    }

    /// <summary>
    /// Under LKR 150,000 a month there is no monthly APIT. Tax is only on the year's
    /// total salary at the first slab of 6% when that total is at least 150,000.
    /// </summary>
    internal static decimal CalculateLowSalaryAnnualApit(decimal monthlySalary)
    {
        if (monthlySalary <= 0)
            return 0;
        var yearly = monthlySalary * 12m;
        if (yearly < 150_000m)
            return 0;
        return Math.Round(yearly * 0.06m, 2);
    }

    /// <summary>
    /// Payslip withholding: Table 01 when monthly salary is above 150,000; otherwise 0.
    /// </summary>
    internal static decimal CalculateMonthlyApitWithAnnualFallback(
        decimal regularTaxable, decimal lumpTaxable = 0)
        => CalculateApit(regularTaxable, lumpTaxable);

    internal static decimal CalculateAnnualApit(decimal regularTaxable, decimal lumpTaxable = 0)
        => CalculateApitTableAnnual(regularTaxable + lumpTaxable);

    /// <summary>
    /// IRD Table 4.1 — monthly APIT for non-resident, non-citizen employees (Y/A 2025/26).
    /// </summary>
    internal static decimal CalculateApitTable41(decimal monthlyProfits)
    {
        if (monthlyProfits <= 0)
            return 0;
        if (monthlyProfits <= 83_333m)
            return Math.Round(monthlyProfits * 0.06m, 2);
        if (monthlyProfits <= 125_000m)
            return Math.Round(monthlyProfits * 0.18m - 10_000m, 2);
        if (monthlyProfits <= 166_667m)
            return Math.Round(monthlyProfits * 0.24m - 17_500m, 2);
        if (monthlyProfits <= 208_333m)
            return Math.Round(monthlyProfits * 0.30m - 27_500m, 2);
        return Math.Max(0, Math.Round(monthlyProfits * 0.36m - 40_000m, 2));
    }

    /// <summary>
    /// IRD Table 4.2 gross tax on cumulative expected income (D) before subtracting Table 4.1.
    /// </summary>
    internal static decimal CalculateApitTable42Gross(decimal cumulativeExpectedIncome)
    {
        var d = Math.Max(0, cumulativeExpectedIncome);
        if (d <= 1_000_000m)
            return Math.Round(d * 0.06m, 2);
        if (d <= 1_500_000m)
            return Math.Round(d * 0.18m - 120_000m, 2);
        if (d <= 2_000_000m)
            return Math.Round(d * 0.24m - 210_000m, 2);
        if (d <= 2_500_000m)
            return Math.Round(d * 0.30m - 330_000m, 2);
        return Math.Max(0, Math.Round(d * 0.36m - 480_000m, 2));
    }

    /// <summary>
    /// Exact / expatriate APIT: Table 4.1 on this month's regular pay plus Table 4.2 on
    /// D = A (already paid) + B (still payable this Y/A) + C (this month's lump).
    /// </summary>
    internal static decimal CalculateExactApit(
        decimal regularTaxable, decimal lumpTaxable = 0,
        decimal priorCumulativeTaxable = 0, int confirmedMonths = 0)
    {
        var regular = Math.Max(0, regularTaxable);
        var lump = Math.Max(0, lumpTaxable);
        var paidMonths = confirmedMonths;
        if (paidMonths <= 0 && priorCumulativeTaxable > 0 && regular > 0)
            paidMonths = (int)Math.Round(priorCumulativeTaxable / regular, MidpointRounding.AwayFromZero);
        paidMonths = Math.Clamp(paidMonths, 0, 11);
        var remainingMonths = 12 - paidMonths;
        var alreadyPaid = Math.Max(0, priorCumulativeTaxable);
        var payable = regular * remainingMonths;
        var expectedIncome = alreadyPaid + payable + lump;

        var averagePaid = paidMonths > 0 ? alreadyPaid / paidMonths : 0m;
        var aggregatedTable41 = Math.Round(
            paidMonths * CalculateApitTable41(averagePaid)
            + remainingMonths * CalculateApitTable41(regular), 2);

        var regularTax = CalculateApitTable41(regular);
        var lumpTax = Math.Max(0, Math.Round(CalculateApitTable42Gross(expectedIncome) - aggregatedTable41, 2));
        return Math.Round(regularTax + lumpTax, 2);
    }

    internal static decimal CalculateApitByMode(
        decimal regularTaxable, decimal lumpTaxable, int calendarMonth, string? mode,
        decimal priorCumulativeTaxable = 0, int confirmedMonths = 0)
    {
        var monthly = CalculateApit(regularTaxable, lumpTaxable);
        return NormalizeApitTaxMode(mode) switch
        {
            ApitTaxModeMonthly => monthly,
            ApitTaxModeAnnual => CalculateAnnualApitIncrement(
                priorCumulativeTaxable, regularTaxable + lumpTaxable),
            _ => CalculateExactApit(regularTaxable, lumpTaxable, priorCumulativeTaxable, confirmedMonths),
        };
    }

    internal readonly record struct ConfirmedApitYtd(
        decimal RegularTaxable, int SalaryMonths, decimal LumpTaxable, decimal LumpApit)
    {
        public decimal TotalTaxable => RegularTaxable + LumpTaxable;
    }

    internal static bool IsApitComponent(CompensationComponent comp)
        => string.Equals(comp.Code, "APIT", StringComparison.OrdinalIgnoreCase)
            || string.Equals(comp.Name, "APIT", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// IRD Table 02 — tax on this lump-sum (bonus) for resident employees.
    /// D = already-paid regular + remaining months × monthly + prior lumps + this lump.
    /// Tax = annual table(D) minus Table 01 already counted for the year minus prior lump tax.
    /// </summary>
    internal static decimal CalculateApitTable02(
        decimal regularMonthly,
        decimal thisLump,
        decimal alreadyPaidRegular = 0,
        int paidMonths = 0,
        decimal priorLumps = 0,
        decimal priorLumpTax = 0)
    {
        var monthly = Math.Max(0, regularMonthly);
        var lump = Math.Max(0, thisLump);
        if (lump <= 0)
            return 0;

        if (paidMonths <= 0 && alreadyPaidRegular > 0 && monthly > 0)
            paidMonths = (int)Math.Round(alreadyPaidRegular / monthly, MidpointRounding.AwayFromZero);
        paidMonths = Math.Clamp(paidMonths, 0, 11);
        var remainingMonths = 12 - paidMonths;
        var expected = alreadyPaidRegular + monthly * remainingMonths + Math.Max(0, priorLumps) + lump;
        var averagePaid = paidMonths > 0 ? alreadyPaidRegular / paidMonths : 0m;
        var aggregatedTable01 = Math.Round(
            paidMonths * CalculateApitTable01(averagePaid)
            + remainingMonths * CalculateApitTable01(monthly), 2);
        return Math.Max(0, Math.Round(
            CalculateApitTableAnnual(expected) - aggregatedTable01 - Math.Max(0, priorLumpTax), 2));
    }

    internal static decimal CalculateBonusApitByMode(
        decimal regularMonthly, decimal thisLump, string? mode, ConfirmedApitYtd prior)
    {
        var lump = Math.Max(0, thisLump);
        return NormalizeApitTaxMode(mode) switch
        {
            ApitTaxModeAnnual => CalculateAnnualApitIncrement(prior.TotalTaxable, lump),
            ApitTaxModeExact => Math.Max(0, Math.Round(
                CalculateExactApit(regularMonthly, lump, prior.TotalTaxable, prior.SalaryMonths)
                - CalculateApitTable41(regularMonthly), 2)),
            _ => CalculateApitTable02(
                regularMonthly, lump, prior.RegularTaxable, prior.SalaryMonths,
                prior.LumpTaxable, prior.LumpApit),
        };
    }

    internal async Task<Dictionary<Guid, ConfirmedApitYtd>> LoadConfirmedApitYtdAsync(
        IReadOnlyCollection<Guid> employeeIds, int calendarYear, int calendarMonth, Guid exceptBatchId)
    {
        var result = employeeIds.ToDictionary(id => id, _ => new ConfirmedApitYtd(0, 0, 0, 0));
        if (employeeIds.Count == 0)
            return result;

        var taxYearStartYear = ApitTaxYearStartYear(calendarMonth, calendarYear);
        var rows = await _db.PayStatements
            .AsNoTracking()
            .Where(s => employeeIds.Contains(s.EmployeeId)
                && s.Status == PayStatementStatus.Finalized
                && s.BatchId != exceptBatchId
                && (s.Batch.ProcessType == PayrollProcessType.Salary
                    || s.Batch.ProcessType == PayrollProcessType.Bonus))
            .Select(s => new
            {
                s.EmployeeId,
                s.Month,
                s.Year,
                s.ApitTaxable,
                s.TotalEarnings,
                s.Batch.ProcessType,
                ApitAmount = s.Lines
                    .Where(l => l.ComponentCode == "APIT")
                    .Sum(l => (decimal?)l.Amount) ?? 0m,
            })
            .ToListAsync();

        foreach (var row in rows)
        {
            if (!IsInApitTaxYear(row.Month, row.Year, taxYearStartYear))
                continue;
            var current = result.GetValueOrDefault(row.EmployeeId);
            var taxable = StatementApitTaxable(row.ApitTaxable, row.TotalEarnings);
            if (row.ProcessType == PayrollProcessType.Bonus)
            {
                result[row.EmployeeId] = current with
                {
                    LumpTaxable = current.LumpTaxable + taxable,
                    LumpApit = current.LumpApit + row.ApitAmount,
                };
            }
            else
            {
                result[row.EmployeeId] = current with
                {
                    RegularTaxable = current.RegularTaxable + taxable,
                    SalaryMonths = current.SalaryMonths + 1,
                };
            }
        }

        return result;
    }

    private async Task<Dictionary<Guid, decimal>> LoadMonthlySalaryAsync(
        HashSet<Guid> employeeIds, DateTime periodStart, DateTime periodEnd)
    {
        if (employeeIds.Count == 0)
            return new Dictionary<Guid, decimal>();

        var fixedCompensations = await _db.EmployeeCompensations
            .Include(ec => ec.Component)
            .Where(ec => ec.IsActive && ec.BatchId == null && employeeIds.Contains(ec.EmployeeId)
                && ec.Component.Type == ComponentType.Earning
                && ec.Component.Category != ComponentCategory.OneTime)
            .ToListAsync();

        return SelectAssignmentsForPeriod(fixedCompensations, periodStart, periodEnd)
            .GroupBy(ec => ec.EmployeeId)
            .ToDictionary(g => g.Key, g => g.Sum(ec => ec.Amount));
    }

    public async Task RebuildEmployeeApitYearBalancesAsync(
        IReadOnlyCollection<Guid> employeeIds, int taxYearStartYear)
    {
        if (employeeIds.Count == 0)
            return;

        var rows = await _db.PayStatements
            .AsNoTracking()
            .Where(s => employeeIds.Contains(s.EmployeeId)
                && s.Status == PayStatementStatus.Finalized
                && (s.Batch.ProcessType == PayrollProcessType.Salary
                    || s.Batch.ProcessType == PayrollProcessType.Bonus))
            .Select(s => new { s.EmployeeId, s.Month, s.Year, s.ApitTaxable, s.TotalEarnings })
            .ToListAsync();

        var taxableByEmployee = employeeIds.ToDictionary(id => id, _ => 0m);
        foreach (var row in rows)
        {
            if (!IsInApitTaxYear(row.Month, row.Year, taxYearStartYear))
                continue;
            taxableByEmployee[row.EmployeeId] = taxableByEmployee.GetValueOrDefault(row.EmployeeId)
                + StatementApitTaxable(row.ApitTaxable, row.TotalEarnings);
        }

        var existing = await _db.EmployeeApitYearBalances
            .Where(b => b.TaxYearStartYear == taxYearStartYear && employeeIds.Contains(b.EmployeeId))
            .ToListAsync();
        var existingByEmployee = existing.ToDictionary(b => b.EmployeeId);

        foreach (var employeeId in employeeIds)
        {
            var taxable = Math.Round(taxableByEmployee.GetValueOrDefault(employeeId), 2);
            var apit = CalculateApitTableAnnual(taxable);
            if (existingByEmployee.TryGetValue(employeeId, out var balance))
            {
                balance.CumulativeTaxable = taxable;
                balance.CumulativeApit = apit;
            }
            else if (taxable > 0 || apit > 0)
            {
                _db.EmployeeApitYearBalances.Add(new EmployeeApitYearBalance
                {
                    EmployeeId = employeeId,
                    TaxYearStartYear = taxYearStartYear,
                    CumulativeTaxable = taxable,
                    CumulativeApit = apit,
                });
            }
        }

        await _db.SaveChangesAsync();
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
            ApitTaxMode = NormalizeApitTaxMode(await _settings.GetAsync("Payroll_APIT_TaxMode")),
        };
    }
}

public class PayrollRates
{
    public decimal EpfEmployeeRate { get; set; } = 0.08m;
    public decimal EpfEmployerRate { get; set; } = 0.12m;
    public decimal EtfEmployerRate { get; set; } = 0.03m;
    public string ApitTaxMode { get; set; } = "Exact";
}
