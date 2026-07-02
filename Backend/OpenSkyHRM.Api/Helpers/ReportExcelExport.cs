using System.Text.Json;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using OpenSkyHRM.Application.DTOs.Reports;

namespace OpenSkyHRM.Api.Helpers;

public static partial class ReportExcelExport
{
    private const string HeaderBackground = "#1e40af";

    public static byte[] BuildWorkbook(ReportResultDto result)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(SanitizeSheetName(result.ReportName));

        var colCount = result.Columns.Count;
        for (var i = 0; i < colCount; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = result.Columns[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml(HeaderBackground);
            cell.Style.Font.FontColor = XLColor.White;
        }

        for (var rowIndex = 0; rowIndex < result.Rows.Count; rowIndex++)
        {
            var row = result.Rows[rowIndex];
            for (var colIndex = 0; colIndex < colCount; colIndex++)
            {
                var column = result.Columns[colIndex];
                row.TryGetValue(column, out var value);
                SetCellValue(ws.Cell(rowIndex + 2, colIndex + 1), value);
            }
        }

        if (colCount > 0)
        {
            ws.Columns(1, colCount).AdjustToContents();
            ws.SheetView.FreezeRows(1);
            if (result.Rows.Count > 0)
                ws.Range(1, 1, result.Rows.Count + 1, colCount).SetAutoFilter();
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static void SetCellValue(IXLCell cell, object? value)
    {
        if (value is null)
        {
            cell.Value = Blank.Value;
            return;
        }

        switch (value)
        {
            case string s:
                cell.Value = s;
                return;
            case int or long or short or byte:
                cell.Value = Convert.ToDouble(value);
                return;
            case float or double or decimal:
                cell.Value = Convert.ToDouble(value);
                return;
            case bool b:
                cell.Value = b;
                return;
            case DateTime dt:
                cell.Value = dt;
                cell.Style.DateFormat.Format = "yyyy-mm-dd";
                return;
            case DateOnly d:
                cell.Value = d.ToDateTime(TimeOnly.MinValue);
                cell.Style.DateFormat.Format = "yyyy-mm-dd";
                return;
            case JsonElement json:
                cell.Value = JsonElementToString(json);
                return;
            default:
                cell.Value = value.ToString() ?? string.Empty;
                return;
        }
    }

    private static string JsonElementToString(JsonElement json) =>
        json.ValueKind switch
        {
            JsonValueKind.String => json.GetString() ?? string.Empty,
            JsonValueKind.Number => json.GetRawText(),
            JsonValueKind.True => "True",
            JsonValueKind.False => "False",
            JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
            _ => json.GetRawText(),
        };

    private static string SanitizeSheetName(string name)
    {
        var trimmed = name.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return "Report";

        var sanitized = SheetNameInvalidChars().Replace(trimmed, " ").Trim();
        if (string.IsNullOrEmpty(sanitized))
            sanitized = "Report";

        return sanitized.Length > 31 ? sanitized[..31] : sanitized;
    }

    [GeneratedRegex(@"[\[\]:\\/?*]")]
    private static partial Regex SheetNameInvalidChars();
}
