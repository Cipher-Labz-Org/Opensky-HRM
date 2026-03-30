using System.Text.Json;
using System.Text.Json.Serialization;
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

        var asOfForYear = AsOfUtcForEntitlementYear(year, DateTime.UtcNow.Date);

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

            var entitled = CalculateEntitlementDecimal(
                employee.JoinDate,
                year,
                rule.RuleConfig,
                rule.RuleType,
                asOfUtcDate: asOfForYear,
                dateOfPermanency: employee.DateOfPermanency,
                probationEndDate: employee.ProbationEndDate,
                employmentType: employee.EmploymentType);

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

        // Apply Leave and most UIs use the current calendar year; admins often recalculate a prior year.
        // Always refresh the current year too so balances are not stale.
        var years = new SortedSet<int> { year, DateTime.UtcNow.Year };

        int totalCreated = 0, totalUpdated = 0;

        foreach (var y in years)
        {
            foreach (var empId in employeeIds)
            {
                var result = await CalculateAndApplyAsync(empId, y);
                totalCreated += result.BalancesCreated;
                totalUpdated += result.BalancesUpdated;
            }
        }

        return new RecalculateAllResult(employeeIds.Count, totalCreated, totalUpdated);
    }

    public async Task<ShopOfficeLeaveEntitlementDto?> GetShopOfficeActEntitlementAsync(Guid employeeId, int year)
    {
        var employee = await _db.Employees.AsNoTracking().FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted);
        if (employee is null) return null;

        var asOf = AsOfUtcForEntitlementYear(year, DateTime.UtcNow.Date);
        var al = CalculateShopOfficeAnnual(
            employee.JoinDate, year, asOf,
            employee.EmploymentType, employee.DateOfPermanency, employee.ProbationEndDate);
        var cl = CalculateShopOfficeCasual(employee.JoinDate, year, asOf);
        return new ShopOfficeLeaveEntitlementDto(year, al, cl);
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
    /// <param name="asOfUtcDate">For the entitlement calendar year: use end of that year when recalculating past years; current year uses today.</param>
    /// <param name="dateOfPermanency">Shop Office annual: first day of permanent employment (optional).</param>
    /// <param name="probationEndDate">Shop Office annual: permanent from day after this if permanency not set.</param>
    /// <param name="employmentType">Shop Office annual: probation-type codes with no end dates → no annual leave until HR updates.</param>
    public static decimal CalculateEntitlementDecimal(
        DateTime joinDate,
        int forYear,
        string ruleConfigJson,
        string ruleType = "ServiceYearBased",
        DateTime? asOfUtcDate = null,
        DateTime? dateOfPermanency = null,
        DateTime? probationEndDate = null,
        string? employmentType = null)
    {
        var asOf = (asOfUtcDate ?? DateTime.UtcNow.Date);
        return ruleType switch
        {
            "ChildOrderBased" => CalculateChildOrderEntitlement(ruleConfigJson),
            "ShopOfficeAnnual" => CalculateShopOfficeAnnual(joinDate, forYear, asOf, employmentType, dateOfPermanency, probationEndDate),
            "ShopOfficeCasual" => CalculateShopOfficeCasual(joinDate, forYear, asOf),
            _ => CalculateServiceYearEntitlement(joinDate, forYear, ruleConfigJson, asOf),
        };
    }

    /// <summary>
    /// Legacy int overload for backward compatibility. Prefer CalculateEntitlementDecimal.
    /// </summary>
    public static int CalculateEntitlement(DateTime joinDate, int forYear, string ruleConfigJson, string ruleType = "ServiceYearBased")
        => (int)Math.Round(CalculateEntitlementDecimal(joinDate, forYear, ruleConfigJson, ruleType), 0);

    private static decimal CalculateServiceYearEntitlement(
        DateTime joinDate,
        int forYear,
        string ruleConfigJson,
        DateTime asOfUtcDate)
    {
        var config = JsonSerializer.Deserialize<ServiceYearConfig>(ruleConfigJson, JsonOpts);
        if (config is null) return 0;

        var join = joinDate.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(joinDate.Date, DateTimeKind.Utc)
            : joinDate.ToUniversalTime().Date;
        var asOf = asOfUtcDate.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(asOfUtcDate.Date, DateTimeKind.Utc)
            : asOfUtcDate.ToUniversalTime().Date;

        // Legacy casual-style JSON: monthly rate each calendar year in join year; full year3PlusDays from next calendar year onward (Shop & Office: no probation/permanency effect).
        if (config.Year1MonthlyRate is > 0 && config.MonthlyAccrualEveryYear && config.Year3PlusDays > 0)
        {
            if (forYear > join.Year)
                return config.Year3PlusDays;
            return MonthlyAccrualForCalendarYear(join, forYear, asOf, config.Year1MonthlyRate.Value);
        }

        int serviceYear = forYear - join.Year + 1;
        if (serviceYear <= 0) return 0;

        // Year 1: join year — either fixed days or monthly rate (0.5 per calendar month elapsed, not future months)
        if (serviceYear == 1)
        {
            if (config.Year1MonthlyRate is > 0)
            {
                // Only the join calendar year uses this branch (serviceYear == 1 ⇒ forYear == join.Year).
                if (join.Year != forYear)
                    return 0;

                if (asOf < join)
                    return 0;

                int firstMonth = join.Month;

                // Through end of entitlement year if already past; otherwise through current calendar month only.
                int lastMonth = forYear < asOf.Year
                    ? 12
                    : forYear > asOf.Year
                        ? 0
                        : asOf.Month;

                if (lastMonth < firstMonth)
                    return 0;

                int monthsElapsed = lastMonth - firstMonth + 1;
                return monthsElapsed * config.Year1MonthlyRate.Value;
            }
            return config.Year1Days;
        }

        // Year 2: pro-rata based on join month (if brackets defined), else fall through
        if (serviceYear == 2)
        {
            int joinMonth = join.Month;
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

    /// <summary>As-of date for entitlement in <paramref name="forYear"/>: past years use 31 Dec; current/future use today (UTC date).</summary>
    public static DateTime AsOfUtcForEntitlementYear(int forYear, DateTime utcTodayDate)
    {
        var today = utcTodayDate.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(utcTodayDate.Date, DateTimeKind.Utc)
            : utcTodayDate.Date;
        if (today.Kind != DateTimeKind.Utc)
            today = today.ToUniversalTime();

        if (forYear < today.Year)
            return new DateTime(forYear, 12, 31, 0, 0, 0, DateTimeKind.Utc);
        return today;
    }

    /// <summary>
    /// Annual leave: (1) none in the joining calendar year and none while on probation; (2) after permanent, first eligible calendar year = join-quarter proration; then 14.
    /// Permanent effective date: <paramref name="dateOfPermanency"/>, else day after <paramref name="probationEndDate"/>, else join if not a probation employment type.
    /// </summary>
    public static decimal CalculateShopOfficeAnnual(
        DateTime joinDate,
        int forYear,
        DateTime asOfUtcDate,
        string? employmentType,
        DateTime? dateOfPermanency,
        DateTime? probationEndDate)
    {
        var join = ToUtcDateOnly(joinDate);
        var asOf = ToUtcDateOnly(asOfUtcDate);

        if (forYear < join.Year)
            return 0;

        if (asOf < join)
            return 0;

        if (forYear == join.Year)
            return 0;

        var permanentFrom = TryGetPermanentEffectiveDateUtc(join, employmentType, dateOfPermanency, probationEndDate);
        if (!permanentFrom.HasValue)
            return 0;

        if (asOf < permanentFrom.Value)
            return 0;

        var firstEligibleYear = Math.Max(join.Year + 1, permanentFrom.Value.Year);
        if (forYear < firstEligibleYear)
            return 0;

        if (forYear == firstEligibleYear)
            return AnnualLeaveDaysByJoinQuarter(join);

        return 14;
    }

    /// <summary>Backward-compatible overload: treats employee as permanent from join (no probation signals).</summary>
    public static decimal CalculateShopOfficeAnnual(DateTime joinDate, int forYear, DateTime asOfUtcDate)
        => CalculateShopOfficeAnnual(joinDate, forYear, asOfUtcDate, null, null, null);

    /// <summary>
    /// First calendar date the employee counts as permanent for annual leave. <see langword="null"/> if still on probation with no end date.
    /// Order: permanency date → day after probation end → join date if employment type is not probation.
    /// </summary>
    public static DateTime? TryGetPermanentEffectiveDateUtc(
        DateTime joinDateUtc,
        string? employmentType,
        DateTime? dateOfPermanency,
        DateTime? probationEndDate)
    {
        if (dateOfPermanency.HasValue)
            return ToUtcDateOnly(dateOfPermanency.Value);

        if (probationEndDate.HasValue)
            return ToUtcDateOnly(probationEndDate.Value).AddDays(1);

        if (!IsProbationEmploymentType(employmentType))
            return ToUtcDateOnly(joinDateUtc);

        return null;
    }

    /// <summary>True for <see cref="EmploymentType.FullTimeProbation"/> or any code ending with "Probation" (case-insensitive).</summary>
    public static bool IsProbationEmploymentType(string? employmentType)
    {
        if (string.IsNullOrWhiteSpace(employmentType))
            return false;
        var t = employmentType.Trim();
        if (t.Equals(nameof(EmploymentType.FullTimeProbation), StringComparison.OrdinalIgnoreCase))
            return true;
        if (t.Equals("Probation", StringComparison.OrdinalIgnoreCase))
            return true;
        return t.EndsWith("Probation", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Jan–Mar 14, Apr–Jun 10, Jul–Sep 7, Oct–Dec 4 (by calendar month of join).</summary>
    public static int AnnualLeaveDaysByJoinQuarter(DateTime joinUtcDate)
    {
        var m = ToUtcDateOnly(joinUtcDate).Month;
        return m switch
        {
            >= 1 and <= 3 => 14,
            >= 4 and <= 6 => 10,
            >= 7 and <= 9 => 7,
            _ => 4,
        };
    }

    /// <summary>
    /// Casual leave: joining year 0.5 day per completed calendar month from join (cap 7); 7 days per later calendar year.
    /// Completed months: join month counts only if join is on the 1st; partial join month does not count.
    /// </summary>
    public static decimal CalculateShopOfficeCasual(DateTime joinDate, int forYear, DateTime asOfUtcDate)
    {
        var join = ToUtcDateOnly(joinDate);
        var asOf = ToUtcDateOnly(asOfUtcDate);

        if (forYear < join.Year)
            return 0;

        var yearEnd = new DateTime(forYear, 12, 31, 0, 0, 0, DateTimeKind.Utc);
        var periodEnd = asOf < yearEnd ? asOf : yearEnd;
        if (periodEnd < join)
            return 0;

        if (forYear > join.Year)
            return 7;

        var completed = CountCompletedCalendarMonthsFromJoin(join, periodEnd);
        var raw = completed * 0.5m;
        return raw > 7 ? 7 : raw;
    }

    /// <summary>
    /// Shop &amp; Office Act — annual leave on termination: &lt; 10 completed months → 1 day per month worked; otherwise 14 days.
    /// </summary>
    public static decimal CalculateShopOfficeTerminationAnnualSettlement(DateTime joinDate, DateTime terminationDate)
    {
        var join = ToUtcDateOnly(joinDate);
        var term = ToUtcDateOnly(terminationDate);
        if (term < join)
            return 0;

        var monthsWorked = CountCompletedCalendarMonthsFromJoin(join, term);
        return monthsWorked < 10 ? monthsWorked : 14;
    }

    /// <summary>Counts calendar months fully completed after the join date (partial join month excluded unless join is on the 1st).</summary>
    public static int CountCompletedCalendarMonthsFromJoin(DateTime joinUtcDate, DateTime periodEndInclusiveUtc)
    {
        var join = ToUtcDateOnly(joinUtcDate);
        var end = ToUtcDateOnly(periodEndInclusiveUtc);
        if (end < join)
            return 0;

        var y = join.Year;
        var m = join.Month;
        if (join.Day > 1)
        {
            m++;
            if (m > 12)
            {
                m = 1;
                y++;
            }
        }

        var count = 0;
        while (true)
        {
            var dim = DateTime.DaysInMonth(y, m);
            var last = new DateTime(y, m, dim, 0, 0, 0, DateTimeKind.Utc);
            if (last > end)
                break;
            count++;
            m++;
            if (m > 12)
            {
                m = 1;
                y++;
            }
        }

        return count;
    }

    private static DateTime ToUtcDateOnly(DateTime dt)
    {
        var d = dt.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(dt.Date, DateTimeKind.Utc)
            : dt.ToUniversalTime().Date;
        return DateTime.SpecifyKind(d, DateTimeKind.Utc);
    }

    /// <summary>
    /// Earned days = monthly rate × calendar months in <paramref name="forYear"/> from first employed month through last elapsed month.
    /// </summary>
    private static decimal MonthlyAccrualForCalendarYear(DateTime join, int forYear, DateTime asOf, decimal monthlyRate)
    {
        if (forYear < join.Year || forYear > asOf.Year)
            return 0;

        if (join.Year == forYear && asOf.Date < join.Date)
            return 0;

        int firstMonth = join.Year == forYear ? join.Month : 1;
        int lastMonth = forYear < asOf.Year ? 12 : asOf.Month;

        if (lastMonth < firstMonth)
            return 0;

        return (lastMonth - firstMonth + 1) * monthlyRate;
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
        [JsonPropertyName("year1Days")]
        public int Year1Days { get; init; }

        [JsonPropertyName("year1MonthlyRate")]
        public decimal? Year1MonthlyRate { get; init; }

        /// <summary>If true, <see cref="Year1MonthlyRate"/> applies every calendar year (months in that year), not only service year 1.</summary>
        [JsonPropertyName("monthlyAccrualEveryYear")]
        public bool MonthlyAccrualEveryYear { get; init; }

        [JsonPropertyName("year2ProRata")]
        public List<ProRataBracket>? Year2ProRata { get; init; }

        [JsonPropertyName("year3PlusDays")]
        public int Year3PlusDays { get; init; }
    }

    private record ProRataBracket
    {
        [JsonPropertyName("joinMonthStart")]
        public int JoinMonthStart { get; init; }

        [JsonPropertyName("joinMonthEnd")]
        public int JoinMonthEnd { get; init; }

        [JsonPropertyName("days")]
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
