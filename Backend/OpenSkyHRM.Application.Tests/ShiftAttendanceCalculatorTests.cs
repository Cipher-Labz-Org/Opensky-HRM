using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class ShiftAttendanceCalculatorTests
{
    private static ShiftPattern CreateDoubleShift() => new()
    {
        Name = "Double 6-2 / 6-2",
        Code = "DBL",
        ShiftType = "Split",
        StartTime = TimeSpan.FromHours(6),
        EndTime = TimeSpan.FromHours(14),
        Session2StartTime = TimeSpan.FromHours(18),
        Session2EndTime = TimeSpan.FromHours(2),
        IsNightShift = true,
        BreakHours = 4,
        AppliesOnMonday = true,
        AppliesOnTuesday = true,
        AppliesOnWednesday = true,
        AppliesOnThursday = true,
        AppliesOnFriday = true,
    };

    [Fact]
    public void GetOvernightSplitWindow_SpanningTwoCalendarDays()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);

        var window = ShiftAttendanceCalculator.GetOvernightSplitWindow(shift, monday);

        Assert.NotNull(window);
        Assert.Equal(monday.Date, window!.ShiftDate);
        Assert.Equal(monday.Date.AddHours(6), window.WindowStart);
        Assert.Equal(monday.Date.AddDays(1).AddHours(2), window.WindowEnd);
        Assert.Equal(monday.Date.AddHours(18), window.Session2Start);
        Assert.Equal(monday.Date.AddDays(1).AddHours(2), window.Session2End);
    }

    [Fact]
    public void AggregateOvernightSplitPunches_FourPunches_ProducesSixteenHours()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);
        var window = ShiftAttendanceCalculator.GetOvernightSplitWindow(shift, monday)!;

        var punches = new[]
        {
            monday.AddHours(6),
            monday.AddHours(14),
            monday.AddHours(18),
            monday.AddDays(1).AddHours(2),
        };

        var result = ShiftAttendanceCalculator.AggregateOvernightSplitPunches(window, punches);

        Assert.Equal(punches[0], result.PunchIn);
        Assert.Equal(punches[3], result.PunchOut);
        Assert.Equal(16m, result.WorkedHours);
    }

    [Fact]
    public void AggregateOvernightSplitPunches_TuesdayOutPunch_AttachesToMondayShiftDate()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);
        var window = ShiftAttendanceCalculator.GetOvernightSplitWindow(shift, monday)!;

        var punches = new[]
        {
            monday.AddHours(6),
            monday.AddHours(14),
            monday.AddHours(18),
            monday.AddDays(1).AddHours(2),
        };

        var inWindow = punches.Where(p => p >= window.WindowStart && p <= window.WindowEnd).ToList();
        Assert.Equal(4, inWindow.Count);
        Assert.Equal(monday.AddDays(1).AddHours(2), inWindow[^1]);
    }

    [Fact]
    public void GetExpectedWorkedHours_SplitShift_IsSumOfBothSessions()
    {
        var shift = CreateDoubleShift();
        var hours = ShiftAttendanceCalculator.GetExpectedWorkedHours(shift, new DateTime(2026, 5, 25));
        Assert.Equal(16m, hours);
    }

    [Fact]
    public void IsSpilloverOnlyCalendarDay_TuesdayTwoAmOnly_IsTrue()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);
        var window = ShiftAttendanceCalculator.GetOvernightSplitWindow(shift, monday)!;
        var tuesdayPunches = new[] { monday.AddDays(1).AddHours(2) };

        var isSpillover = ShiftAttendanceCalculator.IsSpilloverOnlyCalendarDay(
            window,
            shift,
            tuesdayPunches,
            tuesdayPunches[0],
            tuesdayPunches[0]);

        Assert.True(isSpillover);
    }

    [Fact]
    public void IsSpilloverOnlyCalendarDay_TuesdaySixAmStart_IsFalse()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);
        var window = ShiftAttendanceCalculator.GetOvernightSplitWindow(shift, monday)!;
        var tuesdaySix = monday.AddDays(1).AddHours(6);

        var isSpillover = ShiftAttendanceCalculator.IsSpilloverOnlyCalendarDay(
            window,
            shift,
            new[] { tuesdaySix },
            tuesdaySix,
            null);

        Assert.False(isSpillover);
    }

    [Fact]
    public void ResolveSession2EndDateTime_AddsOneDayForOvernightSplit()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);

        var end = ShiftAttendanceCalculator.ResolveSession2EndDateTime(shift, monday);

        Assert.Equal(monday.Date.AddDays(1).AddHours(2), end);
    }

    private static ShiftPattern CreateRegularShift() => new()
    {
        Name = "Office 9-5",
        Code = "OFF",
        ShiftType = "Regular",
        StartTime = TimeSpan.FromHours(9),
        EndTime = TimeSpan.FromHours(17),
        AppliesOnMonday = true,
        AppliesOnTuesday = true,
        AppliesOnWednesday = true,
        AppliesOnThursday = true,
        AppliesOnFriday = true,
    };

    [Fact]
    public void ComputePrePostOtHours_EarlyArrival_ProducesPreOt()
    {
        var shift = CreateRegularShift();
        var date = new DateTime(2026, 8, 19);
        var punchIn = date.AddHours(8);
        var punchOut = date.AddHours(17);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, date, punchIn, punchOut);

        Assert.Equal(1m, result.PreOtHours);
        Assert.Equal(0m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_LateDeparture_ProducesPostOt()
    {
        var shift = CreateRegularShift();
        var date = new DateTime(2026, 8, 19);
        var punchIn = date.AddHours(9);
        var punchOut = date.AddHours(18);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, date, punchIn, punchOut);

        Assert.Equal(0m, result.PreOtHours);
        Assert.Equal(1m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_EarlyAndLate_ProducesBoth()
    {
        var shift = CreateRegularShift();
        var date = new DateTime(2026, 8, 19);
        var punchIn = date.AddHours(8);
        var punchOut = date.AddHours(18);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, date, punchIn, punchOut);

        Assert.Equal(1m, result.PreOtHours);
        Assert.Equal(1m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_LateArrival_NoPreOt()
    {
        var shift = CreateRegularShift();
        var date = new DateTime(2026, 8, 19);
        var punchIn = date.AddHours(10);
        var punchOut = date.AddHours(17);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, date, punchIn, punchOut);

        Assert.Equal(0m, result.PreOtHours);
        Assert.Equal(0m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_MissingPunchOut_ReturnsZero()
    {
        var shift = CreateRegularShift();
        var date = new DateTime(2026, 8, 19);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, date, date.AddHours(8), null);

        Assert.Equal(0m, result.PreOtHours);
        Assert.Equal(0m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_FlexiShift_ReturnsZero()
    {
        var shift = new ShiftPattern
        {
            ShiftType = "Flexi",
            FlexiWindowStart = TimeSpan.FromHours(7),
            FlexiWindowEnd = TimeSpan.FromHours(18),
            AppliesOnMonday = true,
        };
        var date = new DateTime(2026, 8, 18);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(
            shift, date, date.AddHours(6), date.AddHours(19));

        Assert.Equal(0m, result.PreOtHours);
        Assert.Equal(0m, result.PostOtHours);
    }

    [Fact]
    public void ComputePrePostOtHours_SplitShift_UsesSessionBoundaries()
    {
        var shift = CreateDoubleShift();
        var monday = new DateTime(2026, 5, 25);
        var punchIn = monday.AddHours(5);
        var punchOut = monday.AddDays(1).AddHours(3);

        var result = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, monday, punchIn, punchOut);

        Assert.Equal(1m, result.PreOtHours);
        Assert.Equal(1m, result.PostOtHours);
    }

    [Fact]
    public void CountsAsPresent_SystemAbsent_IsFalse()
    {
        Assert.False(ShiftAttendanceCalculator.CountsAsPresent("Absent", null));
        Assert.False(ShiftAttendanceCalculator.CountsAsPresent("On Leave", null));
    }

    [Fact]
    public void CountsAsPresent_PresentLateHalfDay_IsTrue()
    {
        Assert.True(ShiftAttendanceCalculator.CountsAsPresent("Present", null));
        Assert.True(ShiftAttendanceCalculator.CountsAsPresent("Late", new DateTime(2026, 8, 11, 9, 0, 0)));
        Assert.True(ShiftAttendanceCalculator.CountsAsPresent("Half Day", null));
    }

    [Fact]
    public void ResolveWorkedHours_UsesStoredValueWhenPositive()
    {
        var hours = ShiftAttendanceCalculator.ResolveWorkedHours(
            8m,
            new DateTime(2026, 8, 11, 9, 0, 0),
            new DateTime(2026, 8, 11, 18, 0, 0));

        Assert.Equal(8m, hours);
    }

    [Fact]
    public void ResolveWorkedHours_FallsBackToPunchSpanWhenStoredMissing()
    {
        var hours = ShiftAttendanceCalculator.ResolveWorkedHours(
            null,
            new DateTime(2026, 8, 11, 9, 0, 0),
            new DateTime(2026, 8, 11, 17, 0, 0));

        Assert.Equal(8m, hours);
    }

    [Fact]
    public void ResolveWorkedHours_AbsentWithNoPunches_IsZero()
    {
        Assert.Equal(0m, ShiftAttendanceCalculator.ResolveWorkedHours(null, null, null));
    }

    [Fact]
    public void GetShiftTimesForDate_FlexiShift_UsesFlexWindowNotPerDayTimes()
    {
        var shift = new ShiftPattern
        {
            ShiftType = "Flexi",
            StartTime = TimeSpan.FromHours(9),
            EndTime = TimeSpan.FromHours(17),
            FlexiWindowStart = TimeSpan.FromHours(7),
            FlexiWindowEnd = TimeSpan.FromHours(20),
            MinimumWorkHours = 8,
            BreakHours = 1,
            AppliesOnMonday = true,
            MondayStartTime = TimeSpan.FromHours(9),
            MondayEndTime = TimeSpan.FromHours(17),
        };
        var monday = new DateTime(2026, 8, 17);

        var (applies, start, end, hours) = ShiftAttendanceCalculator.GetShiftTimesForDate(
            shift,
            monday,
            TimeSpan.FromHours(9),
            TimeSpan.FromHours(17),
            7m);

        Assert.True(applies);
        Assert.Equal(TimeSpan.FromHours(7), start);
        Assert.Equal(TimeSpan.FromHours(20), end);
        Assert.Equal(8m, hours);
    }

    [Fact]
    public void GetExpectedWorkedHours_FlexiShift_UsesMinimumWorkHours()
    {
        var shift = new ShiftPattern
        {
            ShiftType = "Flexi",
            MinimumWorkHours = 8,
            FlexiWindowStart = TimeSpan.FromHours(7),
            FlexiWindowEnd = TimeSpan.FromHours(20),
            AppliesOnMonday = true,
        };
        var monday = new DateTime(2026, 8, 17);

        var hours = ShiftAttendanceCalculator.GetExpectedWorkedHours(shift, monday);

        Assert.Equal(8m, hours);
    }
}
