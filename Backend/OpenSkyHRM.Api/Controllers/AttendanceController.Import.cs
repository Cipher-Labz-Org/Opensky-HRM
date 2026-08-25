using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Api.Controllers;

public partial class AttendanceController
{
    private static readonly string[] AttendanceImportStatuses =
        ["Present", "Absent", "Late", "Half Day", "On Leave"];

    private static readonly Dictionary<string, string[]> AttendanceImportColumnAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Employee Code"] =
        [
            "Employee Code", "Emp Code", "EmployeeCode", "Employee ID", "Employee No", "Emp No",
            "Employee Number", "Emp Number", "Code", "EmpCode",
        ],
        ["Date"] = ["Date", "Attendance Date", "Work Date", "Att Date", "Day"],
        ["Punch In"] =
        [
            "Punch In", "PunchIn", "In Time", "Time In", "Check In", "CheckIn", "In",
            "Punch In Time", "Time In", "Start Time", "Start",
        ],
        ["Punch Out"] =
        [
            "Punch Out", "PunchOut", "Out Time", "Time Out", "Check Out", "CheckOut", "Out",
            "Punch Out Time", "End Time", "End",
        ],
        ["Status"] = ["Status", "Attendance Status", "Type", "Attendance Type", "Attendance"],
        ["Remarks"] = ["Remarks", "Notes", "Comment", "Comments", "Note"],
    };

    [HttpPost("import")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportFromExcel(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest(new { message = "Only .xlsx or .xls files are supported." });

        var employees = await _db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted)
            .Select(e => new { e.Id, e.EmployeeCode, e.FirstName, e.LastName })
            .ToListAsync();
        var employeeByCode = employees
            .Where(e => !string.IsNullOrWhiteSpace(e.EmployeeCode))
            .GroupBy(e => e.EmployeeCode!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var allowedUpdateIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");

        var results = new List<AttendanceImportRowResult>();
        var created = 0;
        var updated = 0;
        var skipped = 0;

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = FindAttendanceImportWorksheet(wb);
        if (ws is null)
        {
            return BadRequest(new
            {
                message =
                    "Could not find attendance data. Your Excel must have header columns for employee code and date " +
                    "(e.g. Employee Code, Date, Punch In, Punch Out).",
            });
        }

        var headerMap = BuildImportHeaderMap(ws);
        var empCol = ResolveImportColumn(headerMap, "Employee Code");
        var dateCol = ResolveImportColumn(headerMap, "Date");
        if (empCol is null || dateCol is null)
        {
            return BadRequest(new
            {
                message =
                    "Missing required columns. Include employee code and date headers " +
                    "(e.g. Employee Code, Date, Punch In, Punch Out, Status).",
            });
        }

        var punchInCol = ResolveImportColumn(headerMap, "Punch In");
        var punchOutCol = ResolveImportColumn(headerMap, "Punch Out");
        var statusCol = ResolveImportColumn(headerMap, "Status");
        var remarksCol = ResolveImportColumn(headerMap, "Remarks");

        string? Cell(IXLRow row, int? col)
        {
            if (col is null) return null;
            return GetCellTrimmedDisplayText(row.Cell(col.Value));
        }

        DateTime? DateCell(IXLRow row) => ParseImportDateCell(row, dateCol!.Value);

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (var r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            if (IsImportRowEmpty(row, headerMap))
                continue;

            var empCode = Cell(row, empCol);
            var date = DateCell(row);
            var punchInRaw = Cell(row, punchInCol);
            var punchOutRaw = Cell(row, punchOutCol);
            var statusRaw = Cell(row, statusCol);
            var remarks = Cell(row, remarksCol);

            var errors = new List<string>();
            if (string.IsNullOrWhiteSpace(empCode))
                errors.Add("Employee code is required.");
            if (!date.HasValue)
                errors.Add("Date is required or invalid.");

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(r, empCode ?? "", date, "Skipped", errors));
                continue;
            }

            if (!employeeByCode.TryGetValue(empCode!.Trim(), out var employee))
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Skipped", ["Employee not found."]));
                continue;
            }

            if (allowedUpdateIds != null && !allowedUpdateIds.Contains(employee.Id))
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Skipped", ["You do not have permission to update this employee."]));
                continue;
            }

            if (!await PeopleAccessHelper.CanAccessEmployeeAsync(User, _db, employee.Id, "Update"))
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Skipped", ["You do not have permission to update this employee."]));
                continue;
            }

            var status = NormalizeAttendanceStatus(statusRaw);
            if (status is null)
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(
                    r, empCode, date, "Skipped",
                    [$"Invalid status '{statusRaw}'. Use: {string.Join(", ", AttendanceImportStatuses)}."]));
                continue;
            }

            var punchIn = ParseImportDateTime(date!.Value, punchInRaw);
            var punchOut = ParseImportDateTime(date.Value, punchOutRaw);
            if (punchIn.HasValue && punchOut.HasValue && punchOut <= punchIn)
            {
                skipped++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Skipped", ["Punch Out must be after Punch In."]));
                continue;
            }

            decimal? workedHours = null;
            if (punchIn.HasValue && punchOut.HasValue)
                workedHours = Math.Round((decimal)(punchOut.Value - punchIn.Value).TotalHours, 2);

            var existing = await _db.Set<AttendanceRecord>()
                .Where(a => a.EmployeeId == employee.Id && a.Date == date.Value && !a.IsDeleted)
                .OrderByDescending(a => a.UpdatedAt)
                .FirstOrDefaultAsync();

            if (existing is not null)
            {
                existing.PunchIn = punchIn;
                existing.PunchOut = punchOut;
                existing.WorkedHours = workedHours;
                existing.Status = status;
                existing.Remarks = string.IsNullOrWhiteSpace(remarks) ? existing.Remarks : remarks.Trim();
                existing.Source = "Import";
                updated++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Updated", []));
            }
            else
            {
                _db.Set<AttendanceRecord>().Add(new AttendanceRecord
                {
                    EmployeeId = employee.Id,
                    Date = date.Value,
                    PunchIn = punchIn,
                    PunchOut = punchOut,
                    WorkedHours = workedHours,
                    Status = status,
                    Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim(),
                    Source = "Import",
                });
                created++;
                results.Add(new AttendanceImportRowResult(r, empCode, date, "Created", []));
            }
        }

        if (created > 0 || updated > 0)
            await _db.SaveChangesAsync();

        return Ok(new AttendanceImportUploadResult(created, updated, skipped, results.Count, results));
    }

    private static IXLWorksheet? FindAttendanceImportWorksheet(XLWorkbook wb)
    {
        foreach (var sheet in wb.Worksheets)
        {
            var headerMap = BuildImportHeaderMap(sheet);
            if (ResolveImportColumn(headerMap, "Employee Code").HasValue
                && ResolveImportColumn(headerMap, "Date").HasValue)
            {
                return sheet;
            }
        }

        return wb.Worksheets.FirstOrDefault();
    }

    private static int? ResolveImportColumn(Dictionary<string, int> headerMap, string logicalName)
    {
        if (!AttendanceImportColumnAliases.TryGetValue(logicalName, out var aliases))
            return null;

        foreach (var alias in aliases)
        {
            var key = NormalizeImportHeaderKey(alias);
            if (headerMap.TryGetValue(key, out var col))
                return col;
        }

        foreach (var pair in headerMap)
        {
            foreach (var alias in aliases)
            {
                var normalizedAlias = NormalizeImportHeaderKey(alias);
                if (pair.Key.Contains(normalizedAlias, StringComparison.OrdinalIgnoreCase)
                    || normalizedAlias.Contains(pair.Key, StringComparison.OrdinalIgnoreCase))
                {
                    return pair.Value;
                }
            }
        }

        return null;
    }

    private static Dictionary<string, int> BuildImportHeaderMap(IXLWorksheet ws)
    {
        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var c = 1; c <= (ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
        {
            var key = NormalizeImportHeaderKey(GetCellTrimmedDisplayText(ws.Cell(1, c)));
            if (!string.IsNullOrEmpty(key))
                headerMap[key] = c;
        }

        return headerMap;
    }

    private static bool IsImportRowEmpty(IXLRow row, Dictionary<string, int> headerMap)
    {
        foreach (var col in headerMap.Values)
        {
            var cell = row.Cell(col);
            if (cell.DataType != XLDataType.Blank && !string.IsNullOrWhiteSpace(GetCellTrimmedDisplayText(cell)))
                return false;
        }

        return true;
    }

    private static string? NormalizeAttendanceStatus(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return "Present";

        var trimmed = raw.Trim();
        return AttendanceImportStatuses.FirstOrDefault(s =>
            s.Equals(trimmed, StringComparison.OrdinalIgnoreCase));
    }

    private static DateTime? ParseImportDateCell(IXLRow row, int column)
    {
        var cell = row.Cell(column);
        if (cell.DataType == XLDataType.DateTime)
            return cell.GetDateTime().Date;

        if (cell.DataType == XLDataType.Number && cell.TryGetValue<double>(out var oaDate))
        {
            try
            {
                if (oaDate >= 1 && oaDate < 2958466)
                    return DateTime.FromOADate(oaDate).Date;
            }
            catch (ArgumentException)
            {
                /* fall through */
            }
        }

        var s = GetCellTrimmedDisplayText(cell);
        if (string.IsNullOrEmpty(s)) return null;
        if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var dt)) return dt.Date;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt)) return dt.Date;
        return null;
    }

    private static DateTime? ParseImportDateTime(DateTime date, string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;

        var s = raw.Trim();
        if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var dt))
            return dt;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt))
            return dt;

        if (TimeSpan.TryParse(s, CultureInfo.InvariantCulture, out var ts)
            || TimeSpan.TryParse(s, CultureInfo.CurrentCulture, out ts))
        {
            return date.Date.Add(ts);
        }

        var match = Regex.Match(s, @"^(?<h>\d{1,2}):(?<m>\d{2})(?::(?<sec>\d{2}))?\s*(?<ampm>am|pm)?$", RegexOptions.IgnoreCase);
        if (match.Success
            && int.TryParse(match.Groups["h"].Value, out var h)
            && int.TryParse(match.Groups["m"].Value, out var m))
        {
            if (match.Groups["ampm"].Success)
            {
                var ampm = match.Groups["ampm"].Value.ToLowerInvariant();
                if (ampm == "pm" && h < 12) h += 12;
                if (ampm == "am" && h == 12) h = 0;
            }

            return date.Date.Add(new TimeSpan(h, m, 0));
        }

        return null;
    }

    private static string NormalizeImportHeaderKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        var s = raw.Trim();
        s = s.Replace("\uFEFF", "", StringComparison.Ordinal);
        s = s.Replace("\u00A0", " ", StringComparison.Ordinal);
        s = s.Replace("\u200B", "", StringComparison.Ordinal);
        s = Regex.Replace(s, @"\s+", " ", RegexOptions.CultureInvariant).Trim();
        return s;
    }

    private static string? GetCellTrimmedDisplayText(IXLCell cell)
    {
        if (cell.DataType == XLDataType.Blank)
            return null;

        switch (cell.DataType)
        {
            case XLDataType.Text:
            {
                var t = cell.GetString().Trim();
                return string.IsNullOrEmpty(t) ? null : t;
            }
            case XLDataType.Number:
                if (cell.TryGetValue<double>(out var dbl))
                {
                    if (double.IsNaN(dbl) || double.IsInfinity(dbl))
                        return null;
                    if (Math.Abs(dbl - Math.Truncate(dbl)) < 1e-9)
                        return ((long)Math.Truncate(dbl)).ToString(CultureInfo.InvariantCulture);
                    return dbl.ToString("G", CultureInfo.InvariantCulture);
                }
                var fmt = cell.GetFormattedString().Trim();
                return string.IsNullOrEmpty(fmt) ? null : fmt;
            case XLDataType.Boolean:
                return cell.GetBoolean() ? "true" : "false";
            case XLDataType.DateTime:
                return cell.GetDateTime().ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture);
            default:
            {
                var s = cell.GetFormattedString().Trim();
                if (!string.IsNullOrEmpty(s)) return s;
                s = cell.GetString().Trim();
                return string.IsNullOrEmpty(s) ? null : s;
            }
        }
    }

    public record AttendanceImportRowResult(
        int Row,
        string EmployeeCode,
        DateTime? Date,
        string Status,
        List<string> Errors);

    public record AttendanceImportUploadResult(
        int Created,
        int Updated,
        int Skipped,
        int TotalRows,
        List<AttendanceImportRowResult> Results);
}
