using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.Services;
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
            "Employee Number", "Emp Number", "Code", "EmpCode", "PIN", "Enroll Number", "Enroll No",
            "User ID", "AC-No", "AC No", "Badge", "Badge ID",
        ],
        ["Date"] = ["Date", "Attendance Date", "Work Date", "Att Date", "Day", "Punch Date", "Workday"],
        ["Punch In"] =
        [
            "Punch In", "PunchIn", "In Time", "Time In", "Check In", "CheckIn", "In",
            "Punch In Time", "Start Time", "Start", "Clock In", "ClockIn", "First In",
        ],
        ["Punch Out"] =
        [
            "Punch Out", "PunchOut", "Out Time", "Time Out", "Check Out", "CheckOut", "Out",
            "Punch Out Time", "End Time", "End", "Clock Out", "ClockOut", "Last Out",
        ],
        ["Status"] = ["Status", "Attendance Status", "Type", "Attendance Type", "Attendance"],
        ["Remarks"] = ["Remarks", "Notes", "Comment", "Comments", "Note"],
    };

    [HttpGet("import-template")]
    public IActionResult DownloadAttendanceImportTemplate()
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Attendance");
        string[] headers = ["Employee Code", "Date", "Punch In", "Punch Out", "Status", "Remarks"];
        for (var i = 0; i < headers.Length; i++)
        {
            ws.Cell(1, i + 1).Value = headers[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
        }

        ws.Cell(2, 1).Value = "EMP-0001";
        ws.Cell(2, 2).Value = DateTime.Today;
        ws.Cell(2, 2).Style.DateFormat.Format = "yyyy-mm-dd";
        ws.Cell(2, 3).Value = "08:30";
        ws.Cell(2, 4).Value = "17:30";
        ws.Cell(2, 5).Value = "Present";
        ws.Cell(2, 6).Value = "";

        var refWs = wb.Worksheets.Add("Status values");
        refWs.Cell(1, 1).Value = "Allowed Status";
        refWs.Cell(1, 1).Style.Font.Bold = true;
        for (var i = 0; i < AttendanceImportStatuses.Length; i++)
            refWs.Cell(i + 2, 1).Value = AttendanceImportStatuses[i];
        refWs.Columns().AdjustToContents();
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(
            ms.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "AttendanceImportTemplate.xlsx");
    }

    [HttpPost("import")]
    [HttpPost("import-excel")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10_000_000)]
    [RequestFormLimits(MultipartBodyLengthLimit = 10_000_000)]
    public async Task<IActionResult> ImportFromExcel(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".xlsx" or ".xls" or ".csv"))
            return BadRequest(new { message = "Only .xlsx or .csv files are supported. Save the workbook as Excel Workbook (.xlsx)." });

        var opened = await OpenAttendanceImportWorkbookAsync(file, ext);
        if (opened.Error is not null)
            return opened.Error;

        using var wb = opened.Workbook!;

        var employees = await _db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted)
            .Select(e => new { e.Id, e.EmployeeCode, e.FingerprintId, e.FirstName, e.LastName })
            .ToListAsync();
        var employeeByCode = new Dictionary<string, (Guid Id, string? EmployeeCode)>(StringComparer.OrdinalIgnoreCase);
        var employeeByFingerprint = new Dictionary<string, (Guid Id, string? EmployeeCode)>(StringComparer.OrdinalIgnoreCase);
        foreach (var employee in employees)
        {
            BiometricEmployeeResolver.IndexSpreadsheetLookups(
                employeeByCode,
                employeeByFingerprint,
                employee.EmployeeCode,
                employee.FingerprintId,
                (employee.Id, employee.EmployeeCode));
        }

        var allowedUpdateIds = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Update");

        var results = new List<AttendanceImportRowResult>();
        var created = 0;
        var updated = 0;
        var skipped = 0;

        var layout = FindAttendanceImportLayout(wb);
        if (layout is null)
        {
            return BadRequest(new
            {
                message =
                    "Could not find attendance data. Download the attendance template and keep header columns for " +
                    "Employee Code and Date (optional: Punch In, Punch Out, Status, Remarks).",
            });
        }

        var (ws, headerRow, headerMap) = layout.Value;
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

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? headerRow;
        for (var r = headerRow + 1; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            if (IsImportRowEmpty(row, headerMap))
                continue;

            var empCode = Cell(row, empCol);
            var date = DateCell(row);
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

            if (!TryResolveImportEmployee(employeeByCode, employeeByFingerprint, empCode, out var employee))
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

            var punchIn = ParseImportPunch(row, punchInCol, date!.Value);
            var punchOut = ParseImportPunch(row, punchOutCol, date.Value);
            if (punchIn.HasValue && punchOut.HasValue)
                punchOut = ExcelImportDateParser.ApplyOvernightPunchOutIfNeeded(punchIn.Value, punchOut.Value);

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

    private const string AttendanceImportUnreadableMessage =
        "Could not read the Excel file. Download the attendance template, copy your data into it, and save as Excel Workbook (.xlsx).";

    private static async Task<(XLWorkbook? Workbook, IActionResult? Error)> OpenAttendanceImportWorkbookAsync(
        IFormFile file,
        string ext)
    {
        var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        ms.Position = 0;

        if (LooksLikeOleCompound(ms) || ext == ".xls")
        {
            await ms.DisposeAsync();
            return (null, BadRequestResult(
                "Legacy .xls files are not supported. Open the file in Excel and Save As Excel Workbook (.xlsx)."));
        }

        try
        {
            if (LooksLikeZipPackage(ms))
                return (new XLWorkbook(ms), null);

            if (LooksLikeDelimitedText(ms) || ext == ".csv")
                return (CreateWorkbookFromDelimitedText(ms), null);

            await ms.DisposeAsync();
            return (null, BadRequestResult(AttendanceImportUnreadableMessage));
        }
        catch (Exception)
        {
            await ms.DisposeAsync();
            return (null, BadRequestResult(AttendanceImportUnreadableMessage));
        }
    }

    private static IActionResult BadRequestResult(string message) =>
        new BadRequestObjectResult(new { message });

    private static (IXLWorksheet Worksheet, int HeaderRow, Dictionary<string, int> HeaderMap)? FindAttendanceImportLayout(
        XLWorkbook wb)
    {
        foreach (var sheet in wb.Worksheets)
        {
            var lastRow = Math.Min(sheet.LastRowUsed()?.RowNumber() ?? 0, 20);
            for (var r = 1; r <= lastRow; r++)
            {
                var headerMap = BuildImportHeaderMap(sheet, r);
                if (ResolveImportColumn(headerMap, "Employee Code").HasValue
                    && ResolveImportColumn(headerMap, "Date").HasValue)
                {
                    return (sheet, r, headerMap);
                }
            }
        }

        return null;
    }

    private static bool LooksLikeZipPackage(Stream stream)
    {
        var header = ReadMagic(stream, 2);
        return header.Length >= 2 && header[0] == (byte)'P' && header[1] == (byte)'K';
    }

    private static bool LooksLikeOleCompound(Stream stream)
    {
        var header = ReadMagic(stream, 8);
        return header.Length >= 4
            && header[0] == 0xD0
            && header[1] == 0xCF
            && header[2] == 0x11
            && header[3] == 0xE0;
    }

    private static bool LooksLikeDelimitedText(Stream stream)
    {
        var header = ReadMagic(stream, 512);
        if (header.Length == 0) return false;
        var text = Encoding.UTF8.GetString(header);
        if (text.Contains('\0', StringComparison.Ordinal)) return false;
        return text.Contains(',') || text.Contains('\t') || text.Contains(';');
    }

    private static byte[] ReadMagic(Stream stream, int count)
    {
        var buf = new byte[count];
        var read = stream.Read(buf, 0, count);
        stream.Position = 0;
        if (read == count) return buf;
        Array.Resize(ref buf, read);
        return buf;
    }

    private static XLWorkbook CreateWorkbookFromDelimitedText(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: false);
        var raw = reader.ReadToEnd();
        var lines = raw.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0)
            throw new InvalidOperationException("The file is empty.");

        var delimiter = DetectDelimiter(lines[0]);
        var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Attendance");
        for (var r = 0; r < lines.Length; r++)
        {
            var cells = SplitDelimitedLine(lines[r], delimiter);
            for (var c = 0; c < cells.Count; c++)
                ws.Cell(r + 1, c + 1).Value = cells[c];
        }

        return wb;
    }

    private static char DetectDelimiter(string headerLine)
    {
        var comma = headerLine.Count(ch => ch == ',');
        var tab = headerLine.Count(ch => ch == '\t');
        var semi = headerLine.Count(ch => ch == ';');
        if (tab >= comma && tab >= semi && tab > 0) return '\t';
        if (semi >= comma && semi > 0) return ';';
        return ',';
    }

    private static List<string> SplitDelimitedLine(string line, char delimiter)
    {
        var cells = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];
            if (ch == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch == delimiter && !inQuotes)
            {
                cells.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }

        cells.Add(current.ToString().Trim());
        return cells;
    }

    private static bool TryResolveImportEmployee(
        Dictionary<string, (Guid Id, string? EmployeeCode)> byEmployeeCode,
        Dictionary<string, (Guid Id, string? EmployeeCode)> byFingerprint,
        string? empCode,
        out (Guid Id, string? EmployeeCode) employee)
    {
        employee = default;
        var key = empCode?.Trim();
        if (string.IsNullOrEmpty(key))
            return false;

        if (TryResolveImportAlias(byEmployeeCode, key, out employee))
            return true;
        return TryResolveImportAlias(byFingerprint, key, out employee);
    }

    private static bool TryResolveImportAlias(
        Dictionary<string, (Guid Id, string? EmployeeCode)> lookup,
        string key,
        out (Guid Id, string? EmployeeCode) employee)
    {
        if (lookup.TryGetValue(key, out employee))
            return true;

        foreach (var alias in BiometricEmployeeResolver.GetAliases(key))
        {
            if (lookup.TryGetValue(alias, out employee))
                return true;
        }

        var trimmedZeros = key.TrimStart('0');
        return !string.IsNullOrEmpty(trimmedZeros) && lookup.TryGetValue(trimmedZeros, out employee);
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
                if (normalizedAlias.Length < 4)
                    continue;
                if (pair.Key.Contains(normalizedAlias, StringComparison.OrdinalIgnoreCase)
                    || normalizedAlias.Contains(pair.Key, StringComparison.OrdinalIgnoreCase))
                {
                    return pair.Value;
                }
            }
        }

        return null;
    }

    private static Dictionary<string, int> BuildImportHeaderMap(IXLWorksheet ws, int headerRow)
    {
        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var c = 1; c <= (ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
        {
            var key = NormalizeImportHeaderKey(GetCellTrimmedDisplayText(ws.Cell(headerRow, c)));
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
            return ExcelImportDateParser.ToWallDate(cell.GetDateTime());

        if (cell.DataType == XLDataType.Number && cell.TryGetValue<double>(out var oaDate))
        {
            try
            {
                if (oaDate >= 200 && oaDate < 2958466)
                    return ExcelImportDateParser.FromExcelSerial(oaDate);
            }
            catch (ArgumentException)
            {
                /* fall through */
            }
        }

        return ExcelImportDateParser.ParseWallDate(GetCellTrimmedDisplayText(cell));
    }

    private static DateTime? ParseImportPunch(IXLRow row, int? column, DateTime attendanceDate)
    {
        if (column is null) return null;
        var cell = row.Cell(column.Value);

        if (cell.DataType == XLDataType.DateTime)
            return DateTime.SpecifyKind(attendanceDate.Date.Add(cell.GetDateTime().TimeOfDay), DateTimeKind.Unspecified);

        if (cell.DataType == XLDataType.Number && cell.TryGetValue<double>(out var oaDate) && oaDate is >= 0 and < 2958466)
        {
            try
            {
                if (oaDate < 1)
                    return DateTime.SpecifyKind(attendanceDate.Date.Add(TimeSpan.FromDays(oaDate)), DateTimeKind.Unspecified);
                if (Math.Abs(oaDate - Math.Truncate(oaDate)) > 1e-9)
                    return DateTime.SpecifyKind(attendanceDate.Date.Add(DateTime.FromOADate(oaDate).TimeOfDay), DateTimeKind.Unspecified);
            }
            catch (ArgumentException)
            {
                /* fall through */
            }
        }

        return ExcelImportDateParser.CombineAttendanceDateAndPunch(attendanceDate, GetCellTrimmedDisplayText(cell));
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
