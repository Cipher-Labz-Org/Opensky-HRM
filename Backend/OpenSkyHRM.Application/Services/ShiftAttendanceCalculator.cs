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

    public sealed record PrePostOtHours(decimal PreOtHours, decimal PostOtHours);

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

        if (shift.ShiftType == "Flexi" && shift.MinimumWorkHours.HasValue)
            return shift.MinimumWorkHours.Value;

        var (applies, dayStart, dayEnd, _) = GetShiftTimesForDate(shift, date, shift.StartTime, shift.EndTime, null);
        if (!applies)
            return 0;

        var start = dayStart ?? shift.StartTime;
        var end = dayEnd ?? shift.EndTime;
        var crosses = shift.IsNightShift && end <= start;
        // Work hours match the shift window; break is tracked on the pattern but not deducted here
        // because attendance uses gross punch-in to punch-out time for the same window.
        return Math.Max(0, SessionSpanHours(start, end, crosses));
    }

    /// <summary>
    /// Pre-OT = time worked before official shift start; Post-OT = time worked after official shift end.
    /// Uses strict shift boundaries (no grace). Flexi/Open shifts return zero.
    /// </summary>
    public static PrePostOtHours ComputePrePostOtHours(
        ShiftPattern? shift, DateTime date, DateTime? punchIn, DateTime? punchOut)
    {
        if (shift == null || !ShiftAppliesOnDate(shift, date))
            return new PrePostOtHours(0, 0);

        if (shift.ShiftType is "Flexi" or "Open")
            return new PrePostOtHours(0, 0);

        if (!punchIn.HasValue || !punchOut.HasValue)
            return new PrePostOtHours(0, 0);

        var (shiftStart, shiftEnd) = ResolveOtShiftBoundaries(shift, date);
        if (!shiftStart.HasValue || !shiftEnd.HasValue)
            return new PrePostOtHours(0, 0);

        decimal pre = 0;
        if (punchIn.Value < shiftStart.Value)
            pre = Math.Round((decimal)(shiftStart.Value - punchIn.Value).TotalHours, 2);

        decimal post = 0;
        if (punchOut.Value > shiftEnd.Value)
            post = Math.Round((decimal)(punchOut.Value - shiftEnd.Value).TotalHours, 2);

        return new PrePostOtHours(pre, post);
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

    /// <summary>
    /// Auto-generated Absent rows and approved leave are not attendance.
    /// Present / Late / Half Day count, as does any other status with a punch-in.
    /// </summary>
    public static bool CountsAsPresent(string? status, DateTime? punchIn)
    {
        if (string.Equals(status, "Absent", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "On Leave", StringComparison.OrdinalIgnoreCase))
            return false;

        if (string.Equals(status, "Present", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "Late", StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, "Half Day", StringComparison.OrdinalIgnoreCase))
            return true;

        return punchIn.HasValue;
    }

    public static decimal ResolveWorkedHours(decimal? storedHours, DateTime? punchIn, DateTime? punchOut)
    {
        if (storedHours.HasValue && storedHours.Value > 0)
            return storedHours.Value;

        if (punchIn.HasValue && punchOut.HasValue && punchOut.Value > punchIn.Value)
            return Math.Round((decimal)(punchOut.Value - punchIn.Value).TotalHours, 2);

        return storedHours ?? 0;
    }

    /// <summary>
    /// Punch In is always the first fingerprint and Punch Out is always the last.
    /// Hours are the sum of work stretches (in→out, in→out), so a lunch break
    /// between those taps is not time worked. A single in/out pair still uses the
    /// full span, minus the shift break only when that span covers the whole shift window.
    /// </summary>
    public static PunchAggregation AggregateCalendarDayPunches(
        IReadOnlyList<DateTime> punchTimes,
        IReadOnlyList<string?>? punchStates,
        decimal singleSessionBreakHours = 0,
        decimal fullDayWindowHours = 0)
    {
        if (punchTimes.Count == 0)
            return new PunchAggregation(null, null, null);

        var ordered = new List<(DateTime Time, PunchDirection Direction)>(punchTimes.Count);
        for (var i = 0; i < punchTimes.Count; i++)
        {
            var state = punchStates != null && i < punchStates.Count ? punchStates[i] : null;
            ordered.Add((punchTimes[i], ClassifyPunchDirection(state)));
        }

        ordered.Sort((a, b) => a.Time.CompareTo(b.Time));
        var firstPunch = ordered[0].Time;
        var lastPunch = ordered[^1].Time;
        DateTime? punchOut = lastPunch > firstPunch ? lastPunch : null;

        var punches = CollapseDuplicateTaps(ordered);
        if (punches.Count <= 1)
        {
            decimal? span = punchOut.HasValue
                ? Math.Round((decimal)(lastPunch - firstPunch).TotalHours, 2)
                : null;
            return new PunchAggregation(firstPunch, punchOut, span);
        }

        var sessions = PairWorkSessions(punches);
        if (sessions.Count == 0)
            return new PunchAggregation(firstPunch, punchOut, punchOut.HasValue
                ? Math.Round((decimal)(lastPunch - firstPunch).TotalHours, 2)
                : null);

        var worked = sessions.Sum(s => (decimal)(s.End - s.Start).TotalHours);
        if (sessions.Count == 1
            && singleSessionBreakHours > 0
            && worked > singleSessionBreakHours
            && fullDayWindowHours > singleSessionBreakHours
            && worked + 0.02m >= fullDayWindowHours - 0.25m)
        {
            worked -= singleSessionBreakHours;
        }

        worked = Math.Round(Math.Max(0, worked), 2);
        return new PunchAggregation(firstPunch, punchOut, worked);
    }

    public static PunchAggregation AggregateCalendarDayPunches(
        IReadOnlyList<DateTime> sortedPunchTimes,
        IReadOnlyList<bool> isCheckOutFlags)
    {
        var states = new string?[sortedPunchTimes.Count];
        for (var i = 0; i < sortedPunchTimes.Count && i < isCheckOutFlags.Count; i++)
        {
            if (isCheckOutFlags[i])
                states[i] = "1";
        }

        return AggregateCalendarDayPunches(sortedPunchTimes, states);
    }

    /// <summary>
    /// One attendance row keeps its stored hours. Several non-overlapping rows
    /// (morning and afternoon) are added. Overlapping copies keep the larger value
    /// so a duplicate day is not counted twice.
    /// </summary>
    public static decimal CombineDayWorkedHours(
        IReadOnlyList<(DateTime? PunchIn, DateTime? PunchOut, decimal? WorkedHours)> rows)
    {
        if (rows.Count == 0)
            return 0;

        var withHours = rows.Where(r => r.WorkedHours is > 0).ToList();
        if (withHours.Count == 1)
            return Math.Round(withHours[0].WorkedHours!.Value, 2);

        if (withHours.Count > 1)
        {
            var ordered = withHours.OrderBy(r => r.PunchIn ?? DateTime.MaxValue).ToList();
            var sequential = true;
            for (var i = 1; i < ordered.Count; i++)
            {
                var prevOut = ordered[i - 1].PunchOut;
                var nextIn = ordered[i].PunchIn;
                if (!prevOut.HasValue || !nextIn.HasValue || nextIn.Value < prevOut.Value)
                {
                    sequential = false;
                    break;
                }
            }

            if (sequential)
                return Math.Round(ordered.Sum(r => r.WorkedHours!.Value), 2);

            return Math.Round(ordered.Max(r => r.WorkedHours!.Value), 2);
        }

        DateTime? earliest = null;
        DateTime? latest = null;
        foreach (var row in rows)
        {
            if (row.PunchIn.HasValue && (!earliest.HasValue || row.PunchIn.Value < earliest.Value))
                earliest = row.PunchIn;
            if (row.PunchOut.HasValue && (!latest.HasValue || row.PunchOut.Value > latest.Value))
                latest = row.PunchOut;
        }

        if (earliest.HasValue && latest.HasValue && latest.Value > earliest.Value)
            return Math.Round((decimal)(latest.Value - earliest.Value).TotalHours, 2);

        return 0;
    }

    public enum PunchDirection { Unknown, In, Out }

    public static PunchDirection ClassifyPunchDirection(string? state)
    {
        if (string.IsNullOrWhiteSpace(state))
            return PunchDirection.Unknown;

        var s = state.Trim().ToLowerInvariant();
        // ZKTeco: 0 check-in, 1 check-out, 2 break-out, 3 break-in, 4 OT-in, 5 OT-out.
        if (s is "0" or "3" or "4"
            or "in" or "checkin" or "check-in" or "check in"
            or "breakin" or "break-in" or "break in"
            or "otin" or "ot-in" or "ot in")
            return PunchDirection.In;

        if (s is "1" or "2" or "5"
            or "out" or "checkout" or "check-out" or "check out"
            or "breakout" or "break-out" or "break out"
            or "otout" or "ot-out" or "ot out")
            return PunchDirection.Out;

        return PunchDirection.Unknown;
    }

    private static readonly TimeSpan DuplicateTapWindow = TimeSpan.FromMinutes(2);

    private static List<(DateTime Time, PunchDirection Direction)> CollapseDuplicateTaps(
        List<(DateTime Time, PunchDirection Direction)> sorted)
    {
        var kept = new List<(DateTime Time, PunchDirection Direction)>(sorted.Count);
        foreach (var punch in sorted)
        {
            if (kept.Count == 0)
            {
                kept.Add(punch);
                continue;
            }

            var prev = kept[^1];
            if (punch.Time - prev.Time <= DuplicateTapWindow)
            {
                if (prev.Direction == PunchDirection.Unknown && punch.Direction != PunchDirection.Unknown)
                    kept[^1] = (prev.Time, punch.Direction);
                continue;
            }

            kept.Add(punch);
        }

        return kept;
    }

    private static List<(DateTime Start, DateTime End)> PairWorkSessions(
        List<(DateTime Time, PunchDirection Direction)> punches)
    {
        var hasExplicitIn = punches.Exists(p => p.Direction == PunchDirection.In);
        var hasExplicitOut = punches.Exists(p => p.Direction == PunchDirection.Out);
        var useStates = hasExplicitIn && hasExplicitOut;

        var sessions = new List<(DateTime Start, DateTime End)>();
        DateTime? open = null;
        foreach (var punch in punches)
        {
            var direction = punch.Direction;
            if (!useStates)
                direction = open.HasValue ? PunchDirection.Out : PunchDirection.In;
            else if (direction == PunchDirection.Unknown)
                direction = open.HasValue ? PunchDirection.Out : PunchDirection.In;

            if (direction == PunchDirection.In)
            {
                open ??= punch.Time;
                continue;
            }

            if (open.HasValue && punch.Time > open.Value)
            {
                sessions.Add((open.Value, punch.Time));
                open = null;
            }
        }

        if (sessions.Count == 0 && punches.Count >= 2 && punches[^1].Time > punches[0].Time)
            sessions.Add((punches[0].Time, punches[^1].Time));

        return sessions;
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

    private static (DateTime? start, DateTime? end) ResolveOtShiftBoundaries(ShiftPattern shift, DateTime date)
    {
        var day = date.Date;

        if (shift.ShiftType == "Split"
            && shift.Session2StartTime.HasValue
            && shift.Session2EndTime.HasValue)
        {
            return (day + ResolveSession1Start(shift, date), ResolveSession2EndDateTime(shift, date));
        }

        var (applies, dayStart, dayEnd, _) = GetShiftTimesForDate(shift, date, shift.StartTime, shift.EndTime, null);
        if (!applies || !dayStart.HasValue || !dayEnd.HasValue)
            return (null, null);

        var shiftStart = day + dayStart.Value;
        var shiftEnd = day + dayEnd.Value;
        if (shift.IsNightShift && dayEnd.Value <= dayStart.Value)
            shiftEnd = shiftEnd.AddDays(1);

        return (shiftStart, shiftEnd);
    }

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

        if (shift.ShiftType == "Flexi")
        {
            var flexStart = shift.FlexiWindowStart ?? defaultStart;
            var flexEnd = shift.FlexiWindowEnd ?? defaultEnd;
            var flexHours = shift.MinimumWorkHours
                ?? defaultHours
                ?? Math.Max(0, SessionSpanHours(flexStart, flexEnd, flexEnd <= flexStart));
            return (true, flexStart, flexEnd, flexHours);
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
            var hours = (decimal)(dayEnd.Value - dayStart.Value).TotalHours;
            return (true, dayStart, dayEnd, Math.Max(0, hours));
        }

        if (defaultHours.HasValue)
            return (true, defaultStart, defaultEnd, defaultHours.Value);

        var fullHours = (decimal)(defaultEnd - defaultStart).TotalHours;
        return (true, defaultStart, defaultEnd, Math.Max(0, fullHours));
    }
}
