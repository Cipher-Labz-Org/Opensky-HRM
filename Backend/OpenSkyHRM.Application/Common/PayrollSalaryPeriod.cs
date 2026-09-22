namespace OpenSkyHRM.Application.Common;

/// <summary>
/// Resolves the attendance/OT/nopay date range for a salary month from configured day-of-month bounds.
/// </summary>
public static class PayrollSalaryPeriod
{
    public const int DefaultStartDay = 1;
    public const int DefaultEndDay = 31;

    public static int NormalizeDay(int day)
    {
        if (day < 1) return 1;
        if (day > 31) return 31;
        return day;
    }

    /// <summary>
    /// Maps year/month and start/end day-of-month into an inclusive date range.
    /// When startDay &gt; endDay, the range begins in the previous month.
    /// </summary>
    public static (DateTime From, DateTime To) Resolve(int year, int month, int startDay, int endDay)
    {
        startDay = NormalizeDay(startDay);
        endDay = NormalizeDay(endDay);

        if (startDay <= endDay)
        {
            var daysInMonth = DateTime.DaysInMonth(year, month);
            var from = new DateTime(year, month, Math.Min(startDay, daysInMonth));
            var to = new DateTime(year, month, Math.Min(endDay, daysInMonth));
            return (from, to);
        }

        var prev = new DateTime(year, month, 1).AddMonths(-1);
        var prevDays = DateTime.DaysInMonth(prev.Year, prev.Month);
        var curDays = DateTime.DaysInMonth(year, month);
        var fromCross = new DateTime(prev.Year, prev.Month, Math.Min(startDay, prevDays));
        var toCross = new DateTime(year, month, Math.Min(endDay, curDays));
        return (fromCross, toCross);
    }
}
