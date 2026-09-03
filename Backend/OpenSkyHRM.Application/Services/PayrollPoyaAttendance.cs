using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Counts Poya days an employee actually worked in a payroll period (present / late / half day).
/// </summary>
public static class PayrollPoyaAttendance
{
    public static async Task<Dictionary<Guid, decimal>> GetDaysWorkedByEmployeeAsync(
        AppDbContext db,
        IReadOnlyCollection<Guid> employeeIds,
        DateTime periodFrom,
        DateTime periodTo,
        CancellationToken cancellationToken = default)
    {
        var result = employeeIds.Distinct().ToDictionary(id => id, _ => 0m);
        if (result.Count == 0)
            return result;

        var from = periodFrom.Date;
        var toExclusive = periodTo.Date.AddDays(1);

        var poyaDates = await db.Holidays
            .AsNoTracking()
            .Where(h => h.Kind == HolidayKinds.Poya && h.Date >= from && h.Date < toExclusive)
            .Select(h => h.Date)
            .ToListAsync(cancellationToken);

        if (poyaDates.Count == 0)
            return result;

        var ids = result.Keys.ToList();
        var attendance = await db.AttendanceRecords
            .AsNoTracking()
            .Where(a => ids.Contains(a.EmployeeId) && a.Date >= from && a.Date < toExclusive)
            .Select(a => new { a.EmployeeId, a.Date, a.Status, a.PunchIn })
            .ToListAsync(cancellationToken);

        foreach (var group in attendance.GroupBy(a => a.EmployeeId))
        {
            result[group.Key] = CountDaysWorked(
                poyaDates,
                group.Select(a => (a.Date, a.Status, a.PunchIn)));
        }

        return result;
    }

    public static decimal CountDaysWorked(
        IEnumerable<DateTime> poyaDates,
        IEnumerable<(DateTime Date, string? Status, DateTime? PunchIn)> attendance)
    {
        var byDate = attendance
            .GroupBy(a => a.Date.Date)
            .ToDictionary(g => g.Key, g => g.ToList());

        decimal total = 0;
        foreach (var poya in poyaDates.Select(d => d.Date).Distinct())
        {
            if (!byDate.TryGetValue(poya, out var rows))
                continue;

            if (rows.Any(r => string.Equals(r.Status, "Half Day", StringComparison.OrdinalIgnoreCase)))
                total += 0.5m;
            else if (rows.Any(r => ShiftAttendanceCalculator.CountsAsPresent(r.Status, r.PunchIn)))
                total += 1m;
        }

        return total;
    }
}
