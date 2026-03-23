using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Jobs;

/// <summary>
/// Runs daily at 1:00 AM. On the 1st of each month, accrues leave for employees
/// in their first year who have monthly-rate rules (e.g. 0.5 days casual leave per month).
/// Accrual stops when: (1) the join year ends, or (2) the employee gets confirmed (DateOfPermanency).
/// After that, they get leave according to the month they joined (via Recalculate Balances).
/// </summary>
public class LeaveAccrualJob
{
    private readonly AppDbContext _db;
    private readonly ILogger<LeaveAccrualJob> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public LeaveAccrualJob(AppDbContext db, ILogger<LeaveAccrualJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task ExecuteAsync()
    {
        var now = DateTime.UtcNow.Date;

        // Only run accrual on the 1st of each month
        if (now.Day != 1)
        {
            _logger.LogDebug("Leave accrual skipped: not the 1st of the month");
            return;
        }

        // Accrue for the previous month (the month we just completed)
        var prevMonth = now.AddMonths(-1);
        var year = prevMonth.Year;
        var month = prevMonth.Month;
        var lastDayOfPrevMonth = new DateTime(year, month, DateTime.DaysInMonth(year, month), 0, 0, 0, DateTimeKind.Utc);

        _logger.LogInformation("Running leave accrual for {Year}-{Month:D2}", year, month);

        // Get rules with year1MonthlyRate (e.g. Casual Leave 0.5/month)
        var rules = await _db.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .Where(r => r.IsActive && r.RuleType == "ServiceYearBased")
            .ToListAsync();

        var accrualRules = new List<(LeaveEntitlementRule Rule, decimal MonthlyRate)>();
        foreach (var rule in rules)
        {
            var config = JsonSerializer.Deserialize<ServiceYearConfig>(rule.RuleConfig, JsonOpts);
            if (config?.Year1MonthlyRate is > 0)
                accrualRules.Add((rule, config.Year1MonthlyRate.Value));
        }

        if (accrualRules.Count == 0)
        {
            _logger.LogInformation("No leave types with monthly accrual rules found");
            return;
        }

        // Active employees who joined on or before the last day of the previous month
        var eligibleEmployees = await _db.Employees
            .Where(e => !e.IsDeleted
                && e.JoinDate <= lastDayOfPrevMonth
                && (e.TerminationDate == null || e.TerminationDate > lastDayOfPrevMonth)
                && e.Status != "Terminated")
            .Select(e => new { e.Id, e.JoinDate, e.Gender, e.DateOfPermanency })
            .ToListAsync();

        int accrued = 0;

        foreach (var emp in eligibleEmployees)
        {
            // Must be in first year: join year == accrual year
            int serviceYear = year - emp.JoinDate.Year + 1;
            if (serviceYear != 1)
                continue;

            // Must have joined in or before the accrual month
            if (emp.JoinDate.Year == year && emp.JoinDate.Month > month)
                continue;

            // Stop 0.5/month accrual once employee is confirmed (DateOfPermanency set)
            // Once confirmed, they get leave according to month joined via Recalculate Balances
            if (emp.DateOfPermanency.HasValue && emp.DateOfPermanency.Value <= lastDayOfPrevMonth)
                continue;

            foreach (var (rule, monthlyRate) in accrualRules)
            {
                if (!IsRuleApplicable(rule.RuleConfig, emp.Gender))
                    continue;

                // Skip if already accrued for this month
                var alreadyAccrued = await _db.LeaveMonthlyAccruals
                    .AnyAsync(a => a.EmployeeId == emp.Id && a.LeaveTypeId == rule.LeaveTypeId && a.Year == year && a.Month == month);

                if (alreadyAccrued)
                    continue;

                // Get or create balance for this year
                var balance = await _db.LeaveBalances
                    .FirstOrDefaultAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == rule.LeaveTypeId && b.Year == year);

                if (balance == null)
                {
                    balance = new LeaveBalance
                    {
                        EmployeeId = emp.Id,
                        LeaveTypeId = rule.LeaveTypeId,
                        Year = year,
                        Entitled = monthlyRate,
                        Used = 0,
                        CarriedForward = 0,
                    };
                    _db.LeaveBalances.Add(balance);
                }
                else
                {
                    balance.Entitled += monthlyRate;
                }

                _db.LeaveMonthlyAccruals.Add(new LeaveMonthlyAccrual
                {
                    EmployeeId = emp.Id,
                    LeaveTypeId = rule.LeaveTypeId,
                    Year = year,
                    Month = month,
                    Amount = monthlyRate,
                    AccruedAt = now,
                });

                accrued++;
                _logger.LogDebug("Accrued {Amount} days {LeaveType} for employee {EmployeeId} ({Year}-{Month})",
                    monthlyRate, rule.LeaveType.Name, emp.Id, year, month);
            }
        }

        if (accrued > 0)
        {
            await _db.SaveChangesAsync();
            _logger.LogInformation("Leave accrual complete: {Count} accruals applied for {Year}-{Month}", accrued, year, month);
        }
        else
        {
            _logger.LogInformation("No new accruals for {Year}-{Month}", year, month);
        }
    }

    private static bool IsRuleApplicable(string ruleConfigJson, Gender employeeGender)
    {
        try
        {
            var doc = JsonSerializer.Deserialize<JsonElement>(ruleConfigJson, JsonOpts);
            if (doc.TryGetProperty("applicableGender", out var genderProp))
            {
                var required = genderProp.GetString();
                if (!string.IsNullOrEmpty(required) &&
                    !string.Equals(required, employeeGender.ToString(), StringComparison.OrdinalIgnoreCase))
                    return false;
            }
        }
        catch { /* ignore */ }
        return true;
    }

    private record ServiceYearConfig(decimal? Year1MonthlyRate);
}
