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
                new Holiday { Name = "New Year's Day", Date = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc), Year = 2026 },
                new Holiday { Name = "Independence Day", Date = new DateTime(2026, 2, 4, 0, 0, 0, DateTimeKind.Utc), Year = 2026 },
                new Holiday { Name = "May Day", Date = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc), Year = 2026 },
                new Holiday { Name = "Christmas Day", Date = new DateTime(2026, 12, 25, 0, 0, 0, DateTimeKind.Utc), Year = 2026 },
            };

            context.Holidays.AddRange(holidays);
            await context.SaveChangesAsync();
        }

        // Seed entitlement rules if none exist
        if (!await context.LeaveEntitlementRules.AnyAsync())
        {
            var annualLeave = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-ANN");
            if (annualLeave != null)
            {
                var ruleConfig = """
                {
                  "year1Days": 0,
                  "year2ProRata": [
                    { "joinMonthStart": 1, "joinMonthEnd": 3, "days": 14 },
                    { "joinMonthStart": 4, "joinMonthEnd": 6, "days": 10 },
                    { "joinMonthStart": 7, "joinMonthEnd": 9, "days": 7 },
                    { "joinMonthStart": 10, "joinMonthEnd": 12, "days": 4 }
                  ],
                  "year3PlusDays": 14
                }
                """;

                context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
                {
                    LeaveTypeId = annualLeave.Id,
                    RuleType = "ServiceYearBased",
                    RuleConfig = ruleConfig.Trim(),
                    IsActive = true,
                });
            }

            var casualLeave = await context.LeaveTypes.FirstOrDefaultAsync(lt => lt.Code == "LT-CAS");
            if (casualLeave != null)
            {
                var clRuleConfig = """
                {
                  "year1Days": 0,
                  "year1MonthlyRate": 0.5,
                  "year3PlusDays": 7
                }
                """;

                context.LeaveEntitlementRules.Add(new LeaveEntitlementRule
                {
                    LeaveTypeId = casualLeave.Id,
                    RuleType = "ServiceYearBased",
                    RuleConfig = clRuleConfig.Trim(),
                    IsActive = true,
                });
            }

            await context.SaveChangesAsync();
        }
    }
}
