using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class LeaveEntitlementService : ILeaveEntitlementService
{
    private readonly AppDbContext _db;

    public LeaveEntitlementService(AppDbContext db) => _db = db;

    public async Task<EntitlementResult> CalculateAndApplyAsync(Guid employeeId, int year)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == employeeId);
        if (employee is null) return new EntitlementResult(0, 0);

        var rules = await _db.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .Where(r => r.IsActive)
            .ToListAsync();

        int created = 0, updated = 0;

        foreach (var rule in rules)
        {
            var existing = await _db.LeaveBalances
                .FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.LeaveTypeId == rule.LeaveTypeId && b.Year == year);

            if (!IsRuleApplicable(rule.RuleConfig, employee.Gender))
            {
                if (existing != null)
                    _db.LeaveBalances.Remove(existing);
                continue;
            }

            var entitled = CalculateEntitlementDecimal(employee.JoinDate, year, rule.RuleConfig, rule.RuleType);

            if (existing != null)
            {
                existing.Entitled = entitled;
                existing.Used = await _db.Set<LeaveRequest>()
                    .Where(r => r.EmployeeId == employeeId && r.LeaveTypeId == rule.LeaveTypeId && r.StartDate.Year == year && r.Status == ApprovalStatus.Approved)
                    .SumAsync(r => r.TotalDays);
                updated++;
            }
            else
            {
                _db.LeaveBalances.Add(new LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveTypeId = rule.LeaveTypeId,
                    Year = year,
                    Entitled = entitled,
                    Used = 0,
                    CarriedForward = 0,
                });
                created++;
            }
        }

        await _db.SaveChangesAsync();
        return new EntitlementResult(created, updated);
    }

    public async Task<RecalculateAllResult> RecalculateAllAsync(int year)
    {
        var employeeIds = await _db.Employees
            .Where(e => !e.IsDeleted)
            .Select(e => e.Id)
            .ToListAsync();

        int totalCreated = 0, totalUpdated = 0;

        foreach (var empId in employeeIds)
        {
            var result = await CalculateAndApplyAsync(empId, year);
            totalCreated += result.BalancesCreated;
            totalUpdated += result.BalancesUpdated;
        }

        return new RecalculateAllResult(employeeIds.Count, totalCreated, totalUpdated);
    }

    public async Task<List<EntitlementRuleDto>> GetRulesAsync()
    {
        return await _db.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .OrderBy(r => r.LeaveType.Name)
            .Select(r => new EntitlementRuleDto(
                r.Id, r.LeaveTypeId, r.LeaveType.Name,
                r.RuleType, r.RuleConfig, r.IsActive))
            .ToListAsync();
    }

    public async Task<EntitlementRuleDto> CreateRuleAsync(Guid leaveTypeId, string ruleType, string ruleConfig)
    {
        var rule = new LeaveEntitlementRule
        {
            LeaveTypeId = leaveTypeId,
            RuleType = ruleType,
            RuleConfig = ruleConfig,
            IsActive = true,
        };
        _db.LeaveEntitlementRules.Add(rule);
        await _db.SaveChangesAsync();

        var saved = await _db.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .FirstAsync(r => r.Id == rule.Id);

        return new EntitlementRuleDto(saved.Id, saved.LeaveTypeId, saved.LeaveType.Name,
            saved.RuleType, saved.RuleConfig, saved.IsActive);
    }

    public async Task<EntitlementRuleDto?> UpdateRuleAsync(Guid id, string ruleConfig)
    {
        var rule = await _db.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (rule is null) return null;

        rule.RuleConfig = ruleConfig;
        await _db.SaveChangesAsync();

        return new EntitlementRuleDto(
            rule.Id, rule.LeaveTypeId, rule.LeaveType.Name,
            rule.RuleType, rule.RuleConfig, rule.IsActive);
    }

    public async Task<bool> DeleteRuleAsync(Guid id)
    {
        var rule = await _db.LeaveEntitlementRules.FindAsync(id);
        if (rule is null) return false;
        rule.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Dispatches to the appropriate calculation method based on ruleType.
    /// Returns entitlement as decimal (e.g. 0.5 for half-day).
    /// </summary>
    public static decimal CalculateEntitlementDecimal(DateTime joinDate, int forYear, string ruleConfigJson, string ruleType = "ServiceYearBased")
    {
        return ruleType switch
        {
            "ChildOrderBased" => CalculateChildOrderEntitlement(ruleConfigJson),
            _ => CalculateServiceYearEntitlement(joinDate, forYear, ruleConfigJson),
        };
    }

    /// <summary>
    /// Legacy int overload for backward compatibility. Prefer CalculateEntitlementDecimal.
    /// </summary>
    public static int CalculateEntitlement(DateTime joinDate, int forYear, string ruleConfigJson, string ruleType = "ServiceYearBased")
        => (int)Math.Round(CalculateEntitlementDecimal(joinDate, forYear, ruleConfigJson, ruleType), 0);

    private static decimal CalculateServiceYearEntitlement(DateTime joinDate, int forYear, string ruleConfigJson)
    {
        var config = JsonSerializer.Deserialize<ServiceYearConfig>(ruleConfigJson, JsonOpts);
        if (config is null) return 0;

        int serviceYear = forYear - joinDate.Year + 1;
        if (serviceYear <= 0) return 0;

        // Year 1: join year — either fixed days or monthly rate (0.5 per month worked)
        if (serviceYear == 1)
        {
            if (config.Year1MonthlyRate is > 0)
            {
                // Months from join month to end of year (inclusive). Employee gets 0.5 days per month worked.
                int monthsWorked = 12 - joinDate.Month + 1;
                return (decimal)monthsWorked * config.Year1MonthlyRate!.Value;
            }
            return config.Year1Days;
        }

        // Year 2: pro-rata based on join month (if brackets defined), else fall through
        if (serviceYear == 2)
        {
            int joinMonth = joinDate.Month;
            if (config.Year2ProRata is { Count: > 0 })
            {
                foreach (var bracket in config.Year2ProRata)
                {
                    if (joinMonth >= bracket.JoinMonthStart && joinMonth <= bracket.JoinMonthEnd)
                        return bracket.Days;
                }
            }
            return config.Year3PlusDays;
        }

        return config.Year3PlusDays;
    }

    /// <summary>
    /// For child-order-based rules (e.g. Maternity Leave), returns the default
    /// entitlement. Actual child-specific adjustments are handled manually.
    /// </summary>
    private static decimal CalculateChildOrderEntitlement(string ruleConfigJson)
    {
        var config = JsonSerializer.Deserialize<ChildOrderConfig>(ruleConfigJson, JsonOpts);
        return config?.DefaultDays ?? 0;
    }

    /// <summary>
    /// Checks whether a rule applies to the given employee gender.
    /// Rules with no applicableGender field apply to everyone.
    /// </summary>
    private static bool IsRuleApplicable(string ruleConfigJson, Gender employeeGender)
    {
        var doc = JsonSerializer.Deserialize<JsonElement>(ruleConfigJson, JsonOpts);
        if (doc.TryGetProperty("applicableGender", out var genderProp))
        {
            var required = genderProp.GetString();
            if (!string.IsNullOrEmpty(required) &&
                !string.Equals(required, employeeGender.ToString(), StringComparison.OrdinalIgnoreCase))
                return false;
        }
        return true;
    }

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    // ───── ServiceYearBased config ─────

    private record ServiceYearConfig
    {
        public int Year1Days { get; init; }
        public decimal? Year1MonthlyRate { get; init; }
        public List<ProRataBracket>? Year2ProRata { get; init; }
        public int Year3PlusDays { get; init; }
    }

    private record ProRataBracket
    {
        public int JoinMonthStart { get; init; }
        public int JoinMonthEnd { get; init; }
        public int Days { get; init; }
    }

    // ───── ChildOrderBased config ─────

    private record ChildOrderConfig
    {
        public int DefaultDays { get; init; }
        public List<ChildBracket>? Brackets { get; init; }
    }

    private record ChildBracket
    {
        public int ChildFrom { get; init; }
        public int? ChildTo { get; init; }
        public int Days { get; init; }
    }
}
