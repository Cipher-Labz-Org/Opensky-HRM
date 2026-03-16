using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Persistence.Seeders;

public static class LeaveSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.LeaveTypes.AnyAsync()) return;

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
}
