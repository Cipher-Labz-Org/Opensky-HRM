using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class LeaveDurationRulesTests
{
    [Fact]
    public void HalfDay_IsHalfADay()
    {
        var days = LeaveDurationRules.ResolveTotalDays(
            LeaveDurationKinds.HalfDay,
            new DateTime(2026, 8, 24),
            new DateTime(2026, 8, 24),
            allowHalfDay: true,
            allowShortLeave: false,
            typeShortLeaveHours: 2,
            halfDayPeriod: "Morning",
            requestedShortLeaveHours: null,
            out var period,
            out var hours);

        Assert.Equal(0.5m, days);
        Assert.Equal(HalfDayPeriods.Morning, period);
        Assert.Null(hours);
    }

    [Fact]
    public void ShortLeave_UsesHoursOverEight()
    {
        var days = LeaveDurationRules.ResolveTotalDays(
            LeaveDurationKinds.ShortLeave,
            new DateTime(2026, 8, 24),
            new DateTime(2026, 8, 24),
            allowHalfDay: false,
            allowShortLeave: true,
            typeShortLeaveHours: 2,
            halfDayPeriod: null,
            requestedShortLeaveHours: 2,
            out _,
            out var hours);

        Assert.Equal(0.25m, days);
        Assert.Equal(2, hours);
    }

    [Fact]
    public void HalfDay_RejectedWhenTypeDoesNotAllow()
    {
        Assert.Throws<InvalidOperationException>(() =>
            LeaveDurationRules.ResolveTotalDays(
                LeaveDurationKinds.HalfDay,
                new DateTime(2026, 8, 24),
                new DateTime(2026, 8, 24),
                allowHalfDay: false,
                allowShortLeave: false,
                typeShortLeaveHours: 2,
                halfDayPeriod: "Morning",
                requestedShortLeaveHours: null,
                out _,
                out _));
    }

    [Fact]
    public void ShortLeave_RejectedWhenTypeDoesNotAllow()
    {
        Assert.Throws<InvalidOperationException>(() =>
            LeaveDurationRules.ResolveTotalDays(
                LeaveDurationKinds.ShortLeave,
                new DateTime(2026, 8, 24),
                new DateTime(2026, 8, 24),
                allowHalfDay: true,
                allowShortLeave: false,
                typeShortLeaveHours: 2,
                halfDayPeriod: null,
                requestedShortLeaveHours: 2,
                out _,
                out _));
    }

    [Fact]
    public void ShortLeaveType_IsIdentifiedByCatalogCode()
    {
        Assert.True(LeaveDurationRules.IsShortLeaveType("LT-SHL"));
        Assert.False(LeaveDurationRules.IsShortLeaveType("LT-CAS"));
        LeaveDurationRules.ResolveTypeDurationFlags("LT-SHL", requestedHalfDay: true, requestedHours: 3,
            out var halfDay, out var shortLeave, out var hours);
        Assert.False(halfDay);
        Assert.True(shortLeave);
        Assert.Equal(3, hours);
        decimal? minHours = 1m;
        decimal? maxHours = 3m;
        LeaveDurationRules.NormalizeMinMaxHours(ref minHours, ref maxHours);
        Assert.Equal(1m, minHours);
        Assert.Equal(3m, maxHours);
        LeaveDurationRules.EnsureWithinMinMaxHours(3m, minHours, maxHours);
        Assert.Throws<InvalidOperationException>(() =>
            LeaveDurationRules.EnsureWithinMinMaxHours(4m, minHours: 1m, maxHours: 3m));
    }

    [Fact]
    public void ShortLeave_KeepsPartHours()
    {
        Assert.Equal(1.5m, LeaveDurationRules.ClampShortLeaveHours(1.5m));
        Assert.Equal(1.5m / 8m, LeaveDurationRules.ShortLeaveDays(1.5m));

        var totalDays = LeaveDurationRules.ResolveTotalDays(
            LeaveDurationKinds.ShortLeave,
            new DateTime(2026, 8, 24),
            new DateTime(2026, 8, 24),
            allowHalfDay: false,
            allowShortLeave: true,
            typeShortLeaveHours: 3m,
            halfDayPeriod: null,
            requestedShortLeaveHours: 1.5m,
            out _,
            out var storedHours);

        Assert.Equal(1.5m, storedHours);
        Assert.Equal(1.5m / 8m, totalDays);
    }

    [Fact]
    public void MinMax_RejectsBelowMinimum()
    {
        Assert.Throws<InvalidOperationException>(() =>
            LeaveDurationRules.EnsureWithinMinMax(1m, minDays: 2m, maxDays: 7m));
    }

    [Fact]
    public void MinMax_AllowsWithinRange()
    {
        LeaveDurationRules.EnsureWithinMinMax(0.5m, minDays: null, maxDays: 3m);
    }

    [Fact]
    public void HalfDay_IsAllowedWhenMinimumIsOneFullDay()
    {
        LeaveDurationRules.EnsureWithinMinMax(0.5m, minDays: 1m, maxDays: 7m, LeaveDurationKinds.HalfDay);
    }

    [Fact]
    public void FullDay_StillRejectsBelowMinimum()
    {
        Assert.Throws<InvalidOperationException>(() =>
            LeaveDurationRules.EnsureWithinMinMax(1m, minDays: 2m, maxDays: 7m, LeaveDurationKinds.FullDay));
    }
}
