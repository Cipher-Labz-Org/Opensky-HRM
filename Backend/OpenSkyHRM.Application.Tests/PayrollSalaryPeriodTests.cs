using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class PayrollSalaryPeriodTests
{
    [Theory]
    [InlineData(2026, 9, 1, 31, "2026-09-01", "2026-09-30")]
    [InlineData(2026, 2, 1, 31, "2026-02-01", "2026-02-28")]
    [InlineData(2026, 9, 26, 25, "2026-08-26", "2026-09-25")]
    [InlineData(2026, 1, 26, 25, "2025-12-26", "2026-01-25")]
    [InlineData(2026, 3, 1, 15, "2026-03-01", "2026-03-15")]
    public void Resolve_MapsConfiguredDaysToDateRange(
        int year, int month, int startDay, int endDay, string expectedFrom, string expectedTo)
    {
        var (from, to) = PayrollSalaryPeriod.Resolve(year, month, startDay, endDay);
        Assert.Equal(DateTime.Parse(expectedFrom), from);
        Assert.Equal(DateTime.Parse(expectedTo), to);
    }
}
