using System.Globalization;
using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class ExcelImportDateParserTests
{
    [Theory]
    [InlineData("05/03/1990", 1990, 3, 5)]
    [InlineData("5/3/1990", 1990, 3, 5)]
    [InlineData("15/03/1990", 1990, 3, 15)]
    [InlineData("15/3/90", 1990, 3, 15)]
    [InlineData("1990-03-05", 1990, 3, 5)]
    [InlineData("05-Mar-1990", 1990, 3, 5)]
    [InlineData("5 March 1990", 1990, 3, 5)]
    [InlineData("3/15/1990", 1990, 3, 15)]
    public void ParseWallDate_PrefersDayMonthOverUsMonthDay(string raw, int year, int month, int day)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
            var parsed = ExcelImportDateParser.ParseWallDate(raw);
            Assert.Equal(new DateTime(year, month, day), parsed);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void ParseWallDate_DoesNotSwapAmbiguousDatesWhenServerIsUsEnglish()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
            // Old employee import used DateTime.TryParse(CurrentCulture) first → 3 May.
            Assert.Equal(new DateTime(1990, 5, 3), DateTime.Parse("05/03/1990", CultureInfo.GetCultureInfo("en-US")));
            Assert.Equal(new DateTime(1990, 3, 5), ExcelImportDateParser.ParseWallDate("05/03/1990"));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void FromExcelSerial_UsesCalendarDateNotUtcShift()
    {
        var serial = new DateTime(1990, 3, 5).ToOADate();
        Assert.Equal(new DateTime(1990, 3, 5), ExcelImportDateParser.FromExcelSerial(serial));
    }

    [Fact]
    public void ToWallDate_RoundsExcelFloatJustBelowMidnightToNextDay()
    {
        var almostNext = new DateTime(1990, 3, 4, 23, 59, 59);
        Assert.Equal(new DateTime(1990, 3, 5), ExcelImportDateParser.ToWallDate(almostNext));
    }

    [Theory]
    [InlineData("08:30", 8, 30, 0)]
    [InlineData("8:30 AM", 8, 30, 0)]
    [InlineData("5:45 PM", 17, 45, 0)]
    [InlineData("17:30", 17, 30, 0)]
    [InlineData("1899-12-30 08:30", 8, 30, 0)]
    [InlineData("07/12/2025 08:30", 8, 30, 0)]
    [InlineData("7/12/2025 8:30 AM", 8, 30, 0)]
    public void ParseTimeOfDay_ReadsClockTimeAndIgnoresEmbeddedDate(string raw, int hour, int minute, int second)
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
            Assert.Equal(new TimeSpan(hour, minute, second), ExcelImportDateParser.ParseTimeOfDay(raw));
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void CombineAttendanceDateAndPunch_KeepsDateColumnNotPunchCellDate()
    {
        var previous = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("en-US");
            var day = new DateTime(2025, 12, 7);
            // US parse of 07/12/2025 would be 12 July; punch must still land on 7 Dec.
            var punch = ExcelImportDateParser.CombineAttendanceDateAndPunch(day, "07/12/2025 08:30");
            Assert.Equal(new DateTime(2025, 12, 7, 8, 30, 0), punch);
        }
        finally
        {
            CultureInfo.CurrentCulture = previous;
        }
    }

    [Fact]
    public void ParseTimeOfDay_ReadsExcelFractionOfDay()
    {
        var fraction = new TimeSpan(8, 30, 0).TotalDays;
        Assert.Equal(new TimeSpan(8, 30, 0), ExcelImportDateParser.ParseTimeOfDay(fraction.ToString(CultureInfo.InvariantCulture)));
    }
}
