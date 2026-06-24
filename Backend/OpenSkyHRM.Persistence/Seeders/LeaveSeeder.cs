using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class LeaveSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (!await context.LeaveTypes.AnyAsync())
        {
            var leaveTypes = new[]
            {
                new LeaveType { Name = "Annual Leave", Code = "LT-ANN", DefaultDaysPerYear = 14, IsPaid = true, Description = "Annual vacation leave" },
                new LeaveType { Name = "Casual Leave", Code = "LT-CAS", DefaultDaysPerYear = 7, IsPaid = true, Description = "Short-notice casual leave" },
                new LeaveType { Name = "Sick Leave", Code = "LT-SIC", DefaultDaysPerYear = 14, IsPaid = true, Description = "Medical sick leave" },
                new LeaveType { Name = "Maternity Leave", Code = "LT-MAT", DefaultDaysPerYear = 84, IsPaid = true, Description = "Maternity leave" },
                new LeaveType { Name = "No-Pay Leave", Code = "LT-NPL", DefaultDaysPerYear = 0, IsPaid = false, Description = "Unpaid leave" },
            };

            context.LeaveTypes.AddRange(leaveTypes);

            var holidays = new[]
            {
                new Holiday { Name = "New Year's Day", Date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), Year = 2026, CountryCode = HolidayCountryCodes.LK },
                new Holiday { Name = "Independence Day", Date = new DateTime(2026, 2, 4, 0, 0, 0, DateTimeKind.Utc), Year = 2026, CountryCode = HolidayCountryCodes.LK },
                new Holiday { Name = "May Day", Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc), Year = 2026, CountryCode = HolidayCountryCodes.LK },
                new Holiday { Name = "Christmas Day", Date = new DateTime(2026, 12, 25, 0, 0, 0, DateTimeKind.Utc), Year = 2026, CountryCode = HolidayCountryCodes.LK },
            };

            context.Holidays.AddRange(holidays);
            await context.SaveChangesAsync();
        }

        // Seed entitlement rules if none exist (Sri Lanka Shop & Office Act — calendar year, continuous service)
        if (!await context.LeaveEntitlementRules.AnyAsync())
        {
            var annualLeave = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-ANN");
            if (annualLeave != null)
            {
                context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
                {
                    LeaveTypeId = annualLeave.Id,
                    RuleType = "ShopOfficeAnnual",
                    RuleConfig = "{}",
                    IsActive = true,
                });
            }

            var casualLeave = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-CAS");
            if (casualLeave != null)
            {
                context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
                {
                    LeaveTypeId = casualLeave.Id,
                    RuleType = "ShopOfficeCasual",
                    RuleConfig = "{}",
                    IsActive = true,
                });
            }

            var sickLeave = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-SIC");
            if (sickLeave != null)
            {
                context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
                {
                    LeaveTypeId = sickLeave.Id,
                    RuleType = "ShopOfficeSick",
                    RuleConfig = "{}",
                    IsActive = true,
                });
            }

            await context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// Ensures statutory mercantile holidays exist for all catalog years (idempotent).
    /// </summary>
    public static async Task EnsureMercantileHolidaysAsync(AppDbContext context)
    {
        foreach (var year in MercantileHolidayCatalog.SupportedYears)
            await EnsureMercantileHolidaysForYearAsync(context, year);
    }

    /// <summary>
    /// Adds missing Shop &amp; Office mercantile holidays for the given year.
    /// Existing holidays on the same date (except Restricted) are marked Mercantile.
    /// </summary>
    public static async Task EnsureMercantileHolidaysForYearAsync(AppDbContext context, int year)
    {
        var catalog = MercantileHolidayCatalog.ForYear(year);
        if (catalog.Count == 0)
            return;

        const string country = HolidayCountryCodes.LK;
        var existing = await context.Holidays
            .Where(h => !h.IsDeleted && h.Year == year && h.CountryCode == country)
            .ToListAsync();

        var changed = false;
        foreach (var (name, date) in catalog)
        {
            var onDate = existing.FirstOrDefault(h => h.Date.Date == date.Date);
            if (onDate != null)
            {
                if (onDate.Kind == HolidayKinds.Restricted)
                    continue;
                if (onDate.Kind != HolidayKinds.Mercantile)
                {
                    onDate.Kind = HolidayKinds.Mercantile;
                    onDate.IsRestricted = false;
                    changed = true;
                }
                continue;
            }

            if (existing.Any(h => string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase)))
                continue;

            context.Holidays.Add(new Holiday
            {
                Name = name,
                Date = date,
                Year = year,
                CountryCode = country,
                Kind = HolidayKinds.Mercantile,
                IsRestricted = false,
                Description = "Statutory mercantile holiday (Shop & Office Employees Act)",
            });
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }

    /// <summary>
    /// Ensures full moon Poya holidays exist for all catalog years (idempotent).
    /// </summary>
    public static async Task EnsurePoyaHolidaysAsync(AppDbContext context)
    {
        foreach (var year in PoyaHolidayCatalog.SupportedYears)
            await EnsurePoyaHolidaysForYearAsync(context, year);
    }

    /// <summary>
    /// Adds missing Poya days for the given year. Skips dates that already have a holiday entry.
    /// </summary>
    public static async Task EnsurePoyaHolidaysForYearAsync(AppDbContext context, int year)
    {
        var catalog = PoyaHolidayCatalog.ForYear(year);
        if (catalog.Count == 0)
            return;

        const string country = HolidayCountryCodes.LK;
        var existing = await context.Holidays
            .Where(h => !h.IsDeleted && h.Year == year && h.CountryCode == country)
            .ToListAsync();

        var changed = false;
        foreach (var (name, date) in catalog)
        {
            var onDate = existing.FirstOrDefault(h => h.Date.Date == date.Date);
            if (onDate is not null)
            {
                if (onDate.Kind == HolidayKinds.Restricted)
                    continue;

                var isPoyaName = string.Equals(onDate.Name, name, StringComparison.OrdinalIgnoreCase)
                    || onDate.Name.Contains("Full Moon Poya", StringComparison.OrdinalIgnoreCase);
                if (isPoyaName && onDate.Kind != HolidayKinds.Poya)
                {
                    onDate.Kind = HolidayKinds.Poya;
                    changed = true;
                }

                continue;
            }

            if (existing.Any(h => string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase)))
                continue;

            context.Holidays.Add(new Holiday
            {
                Name = name,
                Date = date,
                Year = year,
                CountryCode = country,
                Kind = HolidayKinds.Poya,
                IsRestricted = false,
                Description = "Full moon Poya day (auto)",
            });
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }

    /// <summary>
    /// Ensures statutory and public holidays for the selected country and year (idempotent).
    /// </summary>
    public static async Task EnsureCountryHolidaysForYearAsync(AppDbContext context, int year, string countryCode)
    {
        countryCode = HolidayCountryCodes.Normalize(countryCode);
        if (countryCode == HolidayCountryCodes.LK)
        {
            await EnsureMercantileHolidaysForYearAsync(context, year);
            await EnsurePoyaHolidaysForYearAsync(context, year);
            return;
        }

        await EnsureInternationalPublicHolidaysForCountryYearAsync(context, year, countryCode);
    }

    /// <summary>
    /// Adds national public holidays for US, GB, IN, AU.
    /// </summary>
    public static async Task EnsureInternationalPublicHolidaysForCountryYearAsync(
        AppDbContext context, int year, string countryCode)
    {
        countryCode = HolidayCountryCodes.Normalize(countryCode);
        if (countryCode == HolidayCountryCodes.LK)
            return;

        var catalog = InternationalPublicHolidayCatalog.ForCountryYear(countryCode, year);
        if (catalog.Count == 0)
            return;

        var existing = await context.Holidays
            .Where(h => !h.IsDeleted && h.Year == year && h.CountryCode == countryCode)
            .ToListAsync();

        var changed = false;
        foreach (var (name, date) in catalog)
        {
            if (existing.Any(h => h.Date.Date == date.Date))
                continue;
            if (existing.Any(h => string.Equals(h.Name, name, StringComparison.OrdinalIgnoreCase)))
                continue;

            context.Holidays.Add(new Holiday
            {
                Name = name,
                Date = date,
                Year = year,
                CountryCode = countryCode,
                Kind = HolidayKinds.Public,
                IsRestricted = false,
                Description = $"National public holiday ({countryCode}, auto)",
            });
            changed = true;
        }

        if (changed)
            await context.SaveChangesAsync();
    }

    /// <summary>Ensures Sick Leave has a Shop &amp; Office display rule (for DBs created before this rule existed).</summary>
    public static async Task EnsureShopOfficeSickLeaveRuleAsync(AppDbContext context)
    {
        var sick = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-SIC" && !lt.IsDeleted);
        if (sick == null) return;

        var existing = await context.LeaveEntitlementRules
            .FirstOrDefaultAsync(r => r.LeaveTypeId == sick.Id && !r.IsDeleted);
        if (existing == null)
        {
            context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
            {
                LeaveTypeId = sick.Id,
                RuleType = "ShopOfficeSick",
                RuleConfig = "{}",
                IsActive = true,
            });
            await context.SaveChangesAsync();
            return;
        }

        if (existing.RuleType == "ServiceYearBased")
        {
            existing.RuleType = "ShopOfficeSick";
            existing.RuleConfig = "{}";
            await context.SaveChangesAsync();
        }
    }

    /// <summary>Ensures the standard catalog leave types exist (for databases created before Sick/Maternity/No-Pay were added).</summary>
    public static async Task EnsureCatalogLeaveTypesAsync(AppDbContext context)
    {
        var catalog = new[]
        {
            new LeaveType { Name = "Annual Leave", Code = "LT-ANN", DefaultDaysPerYear = 14, IsPaid = true, Description = "Annual vacation leave" },
            new LeaveType { Name = "Casual Leave", Code = "LT-CAS", DefaultDaysPerYear = 7, IsPaid = true, Description = "Short-notice casual leave" },
            new LeaveType { Name = "Sick Leave", Code = "LT-SIC", DefaultDaysPerYear = 14, IsPaid = true, Description = "Medical sick leave" },
            new LeaveType { Name = "Maternity Leave", Code = "LT-MAT", DefaultDaysPerYear = 84, IsPaid = true, Description = "Maternity leave" },
            new LeaveType { Name = "No-Pay Leave", Code = "LT-NPL", DefaultDaysPerYear = 0, IsPaid = false, Description = "Unpaid leave" },
        };

        foreach (var lt in catalog)
        {
            var exists = await context.LeaveTypes.AnyAsync(x => x.Code == lt.Code && !x.IsDeleted);
            if (exists)
                continue;
            context.LeaveTypes.Add(lt);
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Migrates LT-ANN / LT-CAS rules from legacy ServiceYearBased JSON to Shop &amp; Office Act rule types (idempotent).
    /// </summary>
    public static async Task PatchShopOfficeLeaveRulesAsync(AppDbContext context)
    {
        var rules = await context.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .Where(r => !r.IsDeleted && r.LeaveType != null)
            .ToListAsync();

        foreach (var rule in rules)
        {
            var code = rule.LeaveType!.Code;
            if (rule.RuleType != "ServiceYearBased")
                continue;

            if (code == "LT-ANN")
            {
                rule.RuleType = "ShopOfficeAnnual";
                rule.RuleConfig = "{}";
            }
            else if (code == "LT-CAS")
            {
                rule.RuleType = "ShopOfficeCasual";
                rule.RuleConfig = "{}";
            }
            else if (code == "LT-SIC" && rule.RuleType == "ServiceYearBased")
            {
                rule.RuleType = "ShopOfficeSick";
                rule.RuleConfig = "{}";
            }
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// One-time style patch: enable 0.5 days × each calendar month worked for Casual Leave (every year), for DBs seeded before this flag existed.
    /// </summary>
    public static async Task PatchCasualLeaveMonthlyEveryYearAsync(AppDbContext context)
    {
        var rule = await context.LeaveEntitlementRules
            .Include(r => r.LeaveType)
            .FirstOrDefaultAsync(r => !r.IsDeleted && r.LeaveType != null && r.LeaveType.Code == "LT-CAS");
        if (rule == null || string.IsNullOrWhiteSpace(rule.RuleConfig)) return;

        JsonNode? root;
        try { root = JsonNode.Parse(rule.RuleConfig); }
        catch { return; }

        if (root is not JsonObject obj) return;
        if (obj.TryGetPropertyValue("monthlyAccrualEveryYear", out var existing) && existing is JsonValue jv && jv.TryGetValue<bool>(out var on) && on)
            return;

        obj["monthlyAccrualEveryYear"] = true;
        rule.RuleConfig = obj.ToJsonString();
        await context.SaveChangesAsync();
    }
}
