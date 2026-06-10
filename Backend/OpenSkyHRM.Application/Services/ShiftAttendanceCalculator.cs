using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Shift-window logic for split overnight shifts (e.g. 06:00–14:00 + 18:00–02:00 next day).
/// </summary>
public static class ShiftAttendanceCalculator
{
    public sealed record SplitShiftWindow(
        DateTime ShiftDate,
        DateTime WindowStart,
        DateTime WindowEnd,
        DateTime Session1Start,
        DateTime Session1End,
        DateTime Session2Start,
        DateTime Session2End);

    public sealed record PunchAggregation(
        DateTime? PunchIn,
        DateTime? PunchOut,
        decimal? WorkedHours);

    public static ShiftPattern? ResolveShiftPattern(Employee emp, IReadOnlyList<RosterAssignment> rosters, DateTime date)
    {
        var roster = rosters
            .Where(ra => ra.EmployeeId == emp.Id
                         && ra.EffectiveFrom <= date
                         && (ra.EffectiveTo == null || ra.EffectiveTo >= date))
            .OrderByDescending(ra => ra.EffectiveFrom)
            .FirstOrDefault();

        if (roster?.RosterTemplate?.DefaultShiftPattern != null)
            return roster.RosterTemplate.DefaultShiftPattern;

        return emp.ShiftPattern;
    }

    public static bool ShiftAppliesOnDate(ShiftPattern shift, DateTime date)
    {
        return date.DayOfWeek switch
        {
            DayOfWeek.Monday => shift.AppliesOnMonday,
            DayOfWeek.Tuesday => shift.AppliesOnTuesday,
            DayOfWeek.Wednesday => shift.AppliesOnWednesday,
            DayOfWeek.Thursday => shift.AppliesOnThursday,
            DayOfWeek.Friday => shift.AppliesOnFriday,
            DayOfWeek.Saturday => shift.AppliesOnSaturday,
            DayOfWeek.Sunday => shift.AppliesOnSunday,
            _ => false,
        };
    }

    public static bool IsOvernightSplitShift(ShiftPattern shift) =>
        shift.ShiftType == "Split"
        && shift.Session2StartTime.HasValue
        && shift.Session2EndTime.HasValue
        && (shift.IsNightShift || shift.Session2EndTime.Value <= shift.Session2StartTime.Value);

    public static SplitShiftWindow? GetOvernightSplitWindow(ShiftPattern shift, DateTime shiftDate)
    {
        if (!IsOvernightSplitShift(shift) || !ShiftAppliesOnDate(shift, shiftDate))
            return null;

        var day = shiftDate.Date;
        var session1Start = day + ResolveSession1Start(shift, shiftDate);
        var session1End = day + ResolveSession1End(shift, shiftDate);
        var session2Start = day + shift.Session2StartTime!.Value;
        var session2End = day + shift.Session2EndTime!.Value;
        if (shift.Session2EndTime.Value <= shift.Session2StartTime.Value || shift.IsNightShift)
            session2End = session2End.AddDays(1);

        return new SplitShiftWindow(
            day,
            session1Start,
            session2End,
            session1Start,
            session1End,
            session2Start,
            session2End);
    }

    public static decimal GetExpectedWorkedHours(ShiftPattern shift, DateTime date)
    {
        if (!ShiftAppliesOnDate(shift, date))
            return 0;

        if (shift.ShiftType == "Split"
            && shift.Session2StartTime.HasValue
            && shift.Session2EndTime.HasValue)
        {
            var session1Hours = SessionSpanHours(shift.StartTime, shift.EndTime, crossesMidnight: false);
            var session2CrossesMidnight = shift.IsNightShift
                || shift.Session2EndTime.Value <= shift.Session2StartTime.Value;
            var session2Hours = SessionSpanHours(
                shift.Session2StartTime.Value,
                shift.Session2EndTime.Value,
                session2CrossesMidnight);
            // Break hours represent the gap between sessions, not time worked.
            return Math.Max(0, session1Hours + session2Hours);
        }

        var (applies, dayStart, dayEnd, _) = GetShiftTimesForDate(shift, date, shift.StartTime, shift.EndTime, null);
        if (!applies)
            return 0;

        var start = dayStart ?? shift.StartTime;
        var end = dayEnd ?? shift.EndTime;
        var crosses = shift.IsNightShift && end <= start;
        return Math.Max(0, SessionSpanHours(start, end, crosses) - shift.BreakHours);
    }

    public static DateTime ResolveSession2EndDateTime(ShiftPattern shift, DateTime shiftDate)
    {
        var end = shiftDate.Date + (shift.Session2EndTime ?? shift.EndTime);
        if (shift.ShiftType == "Split"
            && shift.Session2EndTime.HasValue
            && shift.Session2StartTime.HasValue
            && (shift.IsNightShift || shift.Session2EndTime.Value <= shift.Session2StartTime.Value))
        {
            end = end.AddDays(1);
        }
        else if (shift.IsNightShift && shift.EndTime < shift.StartTime)
        {
            end = end.AddDays(1);
        }

        return end;
    }

    public static PunchAggregation AggregateCalendarDayPunches(
        IReadOnlyList<DateTime> sortedPunchTimes,
        IReadOnlyList<bool> isCheckOutFlags)
    {
        if (sortedPunchTimes.Count == 0)
            return new PunchAggregation(null, null, null);

        var punchIn = sortedPunchTimes[0];
        DateTime? punchOut = sortedPunchTimes.Count > 1 ? sortedPunchTimes[^1] : null;

        if (isCheckOutFlags.Count == sortedPunchTimes.Count)
        {
            var checkOuts = sortedPunchTimes
                .Where((_, i) => isCheckOutFlags[i])
                .ToList();
            if (checkOuts.Count > 0)
                punchOut = checkOuts.Max();
        }

        decimal? workedHours = null;
        if (punchIn != default && punchOut.HasValue && punchOut > punchIn)
            workedHours = Math.Round((decimal)(punchOut.Value - punchIn).TotalHours, 2);

        return new PunchAggregation(punchIn, punchOut, workedHours);
    }

    public static PunchAggregation AggregateOvernightSplitPunches(
        SplitShiftWindow window,
        IReadOnlyList<DateTime> sortedPunchTimes)
    {
        var inWindow = sortedPunchTimes
            .Where(p => p >= window.WindowStart && p <= window.WindowEnd)
            .OrderBy(p => p)
            .ToList();

        if (inWindow.Count == 0)
            return new PunchAggregation(null, null, null);

        var punchIn = inWindow[0];
        var punchOut = inWindow[^1];
        var workedHours = ComputeSplitWorkedHours(window, inWindow);

        return new PunchAggregation(punchIn, punchOut, workedHours);
    }

    public static bool IsSpilloverOnlyCalendarDay(
        SplitShiftWindow previousShiftWindow,
        ShiftPattern? shiftOnCalendarDay,
        IReadOnlyList<DateTime> calendarDayPunchTimes,
        DateTime? recordPunchIn,
        DateTime? recordPunchOut)
    {
        var nextShiftStart = GetNextShiftSessionStart(previousShiftWindow.ShiftDate, shiftOnCalendarDay);
        var spillCutoff = previousShiftWindow.Session2End;

        if (calendarDayPunchTimes.Count > 0)
        {
            return calendarDayPunchTimes.All(p => p <= spillCutoff && p < nextShiftStart);
        }

        if (!recordPunchIn.HasValue)
            return false;

        var inCutoff = recordPunchIn.Value <= spillCutoff && recordPunchIn.Value < nextShiftStart;
        var outCutoff = !recordPunchOut.HasValue
            || (recordPunchOut.Value <= spillCutoff && recordPunchOut.Value < nextShiftStart);
        return inCutoff && outCutoff;
    }

    public static DateTime GetNextShiftSessionStart(DateTime previousShiftDate, ShiftPattern? shiftOnNextCalendarDay)
    {
        var nextDay = previousShiftDate.AddDays(1).Date;
        if (shiftOnNextCalendarDay != null && ShiftAppliesOnDate(shiftOnNextCalendarDay, nextDay))
            return nextDay + ResolveSession1Start(shiftOnNextCalendarDay, nextDay);

        return nextDay + TimeSpan.FromHours(24);
    }

    private static decimal? ComputeSplitWorkedHours(SplitShiftWindow window, IReadOnlyList<DateTime> punches)
    {
        if (punches.Count == 0)
            return null;

        decimal total = 0;
        var counted = false;

        if (punches.Count >= 2)
        {
            total += SessionPairHours(window.Session1Start, window.Session1End, punches[0], punches[1]);
            counted = true;
        }

        if (punches.Count >= 4)
        {
            total += SessionPairHours(window.Session2Start, window.Session2End, punches[2], punches[3]);
            counted = true;
        }
        else if (punches.Count == 3)
        {
            total += SessionPairHours(window.Session2Start, window.Session2End, punches[2], window.Session2End);
            counted = true;
        }

        return counted ? Math.Round(total, 2) : null;
    }

    private static decimal SessionPairHours(DateTime sessionStart, DateTime sessionEnd, DateTime punchIn, DateTime punchOut)
    {
        var start = punchIn < sessionStart ? sessionStart : punchIn;
        var end = punchOut > sessionEnd ? sessionEnd : punchOut;
        return end > start ? (decimal)(end - start).TotalHours : 0;
    }

    private static TimeSpan ResolveSession1Start(ShiftPattern shift, DateTime date) =>
        date.DayOfWeek switch
        {
            DayOfWeek.Monday => shift.MondayStartTime ?? shift.StartTime,
            DayOfWeek.Tuesday => shift.TuesdayStartTime ?? shift.StartTime,
            DayOfWeek.Wednesday => shift.WednesdayStartTime ?? shift.StartTime,
            DayOfWeek.Thursday => shift.ThursdayStartTime ?? shift.StartTime,
            DayOfWeek.Friday => shift.FridayStartTime ?? shift.StartTime,
            DayOfWeek.Saturday => shift.SaturdayStartTime ?? shift.StartTime,
            DayOfWeek.Sunday => shift.SundayStartTime ?? shift.StartTime,
            _ => shift.StartTime,
        };

    private static TimeSpan ResolveSession1End(ShiftPattern shift, DateTime date) =>
        date.DayOfWeek switch
        {
            DayOfWeek.Monday => shift.MondayEndTime ?? shift.EndTime,
            DayOfWeek.Tuesday => shift.TuesdayEndTime ?? shift.EndTime,
            DayOfWeek.Wednesday => shift.WednesdayEndTime ?? shift.EndTime,
            DayOfWeek.Thursday => shift.ThursdayEndTime ?? shift.EndTime,
            DayOfWeek.Friday => shift.FridayEndTime ?? shift.EndTime,
            DayOfWeek.Saturday => shift.SaturdayEndTime ?? shift.EndTime,
            DayOfWeek.Sunday => shift.SundayEndTime ?? shift.EndTime,
            _ => shift.EndTime,
        };

    private static decimal SessionSpanHours(TimeSpan start, TimeSpan end, bool crossesMidnight)
    {
        var span = crossesMidnight
            ? TimeSpan.FromHours(24) - start + end
            : end - start;
        return span.TotalHours < 0 ? 0 : (decimal)span.TotalHours;
    }

    internal static (bool applies, TimeSpan? start, TimeSpan? end, decimal hours) GetShiftTimesForDate(
        ShiftPattern shift, DateTime date, TimeSpan defaultStart, TimeSpan defaultEnd, decimal? defaultHours)
    {
        if (!ShiftAppliesOnDate(shift, date))
            return (false, defaultStart, defaultEnd, 0);

        if (shift.ShiftType == "Split"
            && shift.Session2StartTime.HasValue
            && shift.Session2EndTime.HasValue)
        {
            var hours = GetExpectedWorkedHours(shift, date);
            return (true, ResolveSession1Start(shift, date), shift.Session2EndTime, hours);
        }

        TimeSpan? dayStart = date.DayOfWeek switch
        {
            DayOfWeek.Monday => shift.MondayStartTime,
            DayOfWeek.Tuesday => shift.TuesdayStartTime,
            DayOfWeek.Wednesday => shift.WednesdayStartTime,
            DayOfWeek.Thursday => shift.ThursdayStartTime,
            DayOfWeek.Friday => shift.FridayStartTime,
            DayOfWeek.Saturday => shift.SaturdayStartTime,
            DayOfWeek.Sunday => shift.SundayStartTime,
            _ => null,
        };
        TimeSpan? dayEnd = date.DayOfWeek switch
        {
            DayOfWeek.Monday => shift.MondayEndTime,
            DayOfWeek.Tuesday => shift.TuesdayEndTime,
            DayOfWeek.Wednesday => shift.WednesdayEndTime,
            DayOfWeek.Thursday => shift.ThursdayEndTime,
            DayOfWeek.Friday => shift.FridayEndTime,
            DayOfWeek.Saturday => shift.SaturdayEndTime,
            DayOfWeek.Sunday => shift.SundayEndTime,
            _ => null,
        };

        if (dayStart.HasValue && dayEnd.HasValue)
        {
            var hours = (decimal)(dayEnd.Value - dayStart.Value).TotalHours - shift.BreakHours;
            return (true, dayStart, dayEnd, Math.Max(0, hours));
        }

        if (defaultHours.HasValue)
            return (true, defaultStart, defaultEnd, defaultHours.Value);

        var fullHours = (decimal)(defaultEnd - defaultStart).TotalHours - shift.BreakHours;
        return (true, defaultStart, defaultEnd, Math.Max(0, fullHours));
    }
}
