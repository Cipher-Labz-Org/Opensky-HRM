using System.Globalization;
using System.Security.Claims;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Api.Controllers;

public partial class BulkUploadController
{
    [HttpGet("payroll-template")]
    public IActionResult DownloadPayrollTemplate()
    {
        using var wb = new XLWorkbook();

        // ClosedXML 0.105+ may start with zero worksheets — do not assume Worksheet(1) exists.
        var ws = wb.Worksheets.Count > 0 ? wb.Worksheet(1) : wb.Worksheets.Add("DirectDeposits");
        ws.Name = "DirectDeposits";
        var ddCols = new[]
        {
            "Employee Code", "Account Number", "Bank Name", "Account Type", "Bank Code", "Branch Code",
            "Branch Location",
        };
        for (var i = 0; i < ddCols.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = ddCols[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#1e40af");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        ws.SheetView.SplitRow = 1;
        ws.Row(1).Height = 22;
        ws.Columns().AdjustToContents(1, 1);

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "DirectDepositImportTemplate.xlsx");
    }

    [HttpPost("payroll")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadPayroll(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");

        var empByCode = await _db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted)
            .ToDictionaryAsync(e => e.EmployeeCode.Trim(), e => e.Id, StringComparer.OrdinalIgnoreCase);

        var allowedCreate = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Create");

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);

        var directDeposits = await ImportDirectDepositsSheetAsync(wb, empByCode, allowedCreate, User);

        return Ok(new PayrollImportSummary(directDeposits));
    }

    private static IXLWorksheet? TryPayrollSheet(XLWorkbook wb, string name)
    {
        foreach (var s in wb.Worksheets)
        {
            if (string.Equals(s.Name, name, StringComparison.OrdinalIgnoreCase))
                return s;
        }

        return null;
    }

    private static Dictionary<string, int> BuildPayrollHeaderMap(IXLWorksheet ws)
    {
        var map = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (var c = 1; c <= lastCol; c++)
        {
            var raw = GetCellTrimmedDisplayText(ws.Cell(1, c));
            if (string.IsNullOrEmpty(raw)) continue;
            var key = NormalizeImportHeaderKey(raw);
            if (!string.IsNullOrEmpty(key))
                map[key] = c;
        }

        return map;
    }

    private static string? PayrollCell(Dictionary<string, int> map, IXLRow row, string col)
    {
        if (!map.TryGetValue(NormalizeImportHeaderKey(col), out var c)) return null;
        return GetCellTrimmedDisplayText(row.Cell(c));
    }

    private static decimal? PayrollDec(Dictionary<string, int> map, IXLRow row, string col)
    {
        if (!map.TryGetValue(NormalizeImportHeaderKey(col), out var c)) return null;
        var cell = row.Cell(c);
        if (cell.DataType == XLDataType.Number) return (decimal)cell.GetDouble();
        var s = GetCellTrimmedDisplayText(cell);
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.CurrentCulture, out var d)) return d;
        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out d)) return d;
        return null;
    }

    private async Task<bool> CanPayrollAccessEmployeeAsync(ClaimsPrincipal user, Guid employeeId,
        IReadOnlyList<Guid>? allowedIds, string peopleAction)
    {
        if (allowedIds is not null && !allowedIds.Contains(employeeId))
            return false;
        return await PeopleAccessHelper.CanAccessEmployeeAsync(user, _db, employeeId, peopleAction);
    }

    private async Task<PayrollSheetSummary> ImportDirectDepositsSheetAsync(XLWorkbook wb,
        Dictionary<string, Guid> empByCode, IReadOnlyList<Guid>? allowedIds, ClaimsPrincipal user)
    {
        var ws = TryPayrollSheet(wb, "DirectDeposits");
        if (ws is null)
            return new PayrollSheetSummary(0, 0, []);

        var map = BuildPayrollHeaderMap(ws);
        if (!map.ContainsKey(NormalizeImportHeaderKey("Employee Code")))
            return new PayrollSheetSummary(0, 0, []);

        var errors = new List<PayrollRowError>();
        var created = 0;
        var skipped = 0;
        var last = ws.LastRowUsed()?.RowNumber() ?? 1;

        for (var r = 2; r <= last; r++)
        {
            var row = ws.Row(r);
            var code = PayrollCell(map, row, "Employee Code");
            if (string.IsNullOrWhiteSpace(code)) continue;

            if (!empByCode.TryGetValue(code.Trim(), out var empId))
            {
                skipped++;
                errors.Add(new PayrollRowError(r, code, "Employee Code not found."));
                continue;
            }

            if (!await CanPayrollAccessEmployeeAsync(user, empId, allowedIds, "Create"))
            {
                skipped++;
                errors.Add(new PayrollRowError(r, code, "No permission to add bank accounts for this employee."));
                continue;
            }

            var accountNumber = PayrollCell(map, row, "Account Number");
            if (string.IsNullOrWhiteSpace(accountNumber))
            {
                skipped++;
                errors.Add(new PayrollRowError(r, code, "Account Number is required."));
                continue;
            }

            var acctType = PayrollCell(map, row, "Account Type");
            if (string.IsNullOrWhiteSpace(acctType))
                acctType = "Checking";

            _db.BankAccounts.Add(new BankAccount
            {
                EmployeeId = empId,
                AccountNumber = accountNumber.Trim(),
                BankName = PayrollCell(map, row, "Bank Name"),
                AccountType = acctType.Trim(),
                BankCode = PayrollCell(map, row, "Bank Code"),
                BranchCode = PayrollCell(map, row, "Branch Code"),
                BranchLocation = PayrollCell(map, row, "Branch Location"),
            });
            created++;
        }

        if (created > 0)
            await _db.SaveChangesAsync();

        return new PayrollSheetSummary(created, skipped, errors);
    }

    public record PayrollRowError(int Row, string? EmployeeCode, string Message);

    public record PayrollSheetSummary(int Created, int Skipped, List<PayrollRowError> Errors);

    public record PayrollImportSummary(PayrollSheetSummary DirectDeposits);
}
