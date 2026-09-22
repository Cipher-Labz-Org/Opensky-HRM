using OpenSkyHRM.Application.Common;
using Xunit;

namespace OpenSkyHRM.Application.Tests;

public class AttendanceImportColumnsTests
{
    [Fact]
    public void Resolve_MapsManualAttendanceSheetWithoutStealingDateOrType()
    {
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Employee Code"] = 1,
            ["Employee Name"] = 2,
            ["Date"] = 3,
            ["Punch In"] = 4,
            ["Punch Out"] = 5,
            ["Type"] = 6,
            ["Remarks"] = 7,
        };

        var columns = AttendanceImportColumns.Resolve(headers);

        Assert.Equal(1, AttendanceImportColumns.Column(columns, AttendanceImportColumns.EmployeeCode));
        Assert.Equal(2, AttendanceImportColumns.Column(columns, AttendanceImportColumns.EmployeeName));
        Assert.Equal(3, AttendanceImportColumns.Column(columns, AttendanceImportColumns.Date));
        Assert.Equal(4, AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchIn));
        Assert.Equal(5, AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchOut));
        Assert.Equal(6, AttendanceImportColumns.Column(columns, AttendanceImportColumns.Status));
        Assert.Equal(7, AttendanceImportColumns.Column(columns, AttendanceImportColumns.Remarks));
    }

    [Fact]
    public void Resolve_DoesNotMapAttendanceDateToTypeOrGenericTimeToBothPunches()
    {
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Emp Code"] = 1,
            ["Attendance Date"] = 2,
            ["Time"] = 3,
            ["Time Out"] = 4,
            ["Department"] = 5,
        };

        var columns = AttendanceImportColumns.Resolve(headers);

        Assert.Equal(1, AttendanceImportColumns.Column(columns, AttendanceImportColumns.EmployeeCode));
        Assert.Equal(2, AttendanceImportColumns.Column(columns, AttendanceImportColumns.Date));
        Assert.Null(AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchIn));
        Assert.Equal(4, AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchOut));
        Assert.Null(AttendanceImportColumns.Column(columns, AttendanceImportColumns.Status));
    }

    [Fact]
    public void Resolve_UsesEmployeeNameWhenCodeColumnIsMissing()
    {
        var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["Name"] = 1,
            ["Date"] = 2,
            ["In"] = 3,
            ["Out"] = 4,
        };

        var columns = AttendanceImportColumns.Resolve(headers);

        Assert.Null(AttendanceImportColumns.Column(columns, AttendanceImportColumns.EmployeeCode));
        Assert.Equal(1, AttendanceImportColumns.Column(columns, AttendanceImportColumns.EmployeeName));
        Assert.Equal(2, AttendanceImportColumns.Column(columns, AttendanceImportColumns.Date));
        Assert.Equal(3, AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchIn));
        Assert.Equal(4, AttendanceImportColumns.Column(columns, AttendanceImportColumns.PunchOut));
    }

    [Theory]
    [InlineData(null, "Present")]
    [InlineData("", "Present")]
    [InlineData("Present", "Present")]
    [InlineData("P", "Present")]
    [InlineData("HalfDay", "Half Day")]
    [InlineData("Half Day", "Half Day")]
    [InlineData("HD", "Half Day")]
    [InlineData("On Leave", "On Leave")]
    [InlineData("late", "Late")]
    [InlineData("Weekend", null)]
    public void NormalizeStatus_AcceptsManualTypeValues(string? raw, string? expected)
    {
        Assert.Equal(expected, AttendanceImportColumns.NormalizeStatus(raw));
    }
}
