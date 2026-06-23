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
}
