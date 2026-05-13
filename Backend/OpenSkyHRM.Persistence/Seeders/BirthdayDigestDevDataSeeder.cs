using Microsoft.EntityFrameworkCore;

namespace OpenSkyHRM.Persistence.Seeders;

/// <summary>
/// Development helper: if no employee has a birthday in the next 7 UTC calendar days,
/// nudges EMP-0001 so the birthday digest has something to show (local/demo DBs only).
/// </summary>
public static class BirthdayDigestDevDataSeeder
{
    public static async Task EnsureSampleBirthdayInWindowIfEmptyAsync(
        AppDbContext db,
        DateTime utcToday,
        CancellationToken cancellationToken = default)
    {
        var today = utcToday.Kind == DateTimeKind.Utc
            ? utcToday.Date
            : DateTime.SpecifyKind(utcToday, DateTimeKind.Utc).Date;

        if (await AnyBirthdayInNextSevenDaysAsync(db, today, cancellationToken))
            return;

        var emp = await db.Employees.FirstOrDefaultAsync(
            e => e.EmployeeCode == "EMP-0001",
            cancellationToken);
        if (emp is null)
            return;

        var y = 1980;
        var m = today.Month;
        var d = today.Day;
        if (m == 2 && d == 29 && !DateTime.IsLeapYear(y))
            d = 28;

        emp.DateOfBirth = new DateTime(y, m, d, 0, 0, 0, DateTimeKind.Utc);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task<bool> AnyBirthdayInNextSevenDaysAsync(
        AppDbContext db,
        DateTime today,
        CancellationToken cancellationToken)
    {
        var windowEnd = today.AddDays(6);
        var employees = await db.Employees.AsNoTracking()
            .Where(e =>
                e.DateOfBirth.Year > 1900
                && (e.TerminationDate == null || e.TerminationDate.Value.Date >= today))
            .Select(e => e.DateOfBirth)
            .ToListAsync(cancellationToken);

        for (var d = today; d <= windowEnd; d = d.AddDays(1))
        {
            foreach (var dob in employees)
            {
                if (IsBirthdayAnniversary(d, dob))
                    return true;
            }
        }

        return false;
    }

    private static bool IsBirthdayAnniversary(DateTime calendarDate, DateTime dateOfBirth)
    {
        var month = dateOfBirth.Month;
        var day = dateOfBirth.Day;
        if (month == 2 && day == 29 && !DateTime.IsLeapYear(calendarDate.Year))
            day = 28;
        return calendarDate.Month == month && calendarDate.Day == day;
    }
}
