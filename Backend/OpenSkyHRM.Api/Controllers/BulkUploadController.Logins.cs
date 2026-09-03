using System.Security.Claims;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenSkyHRM.Api.Services;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Domain.Entities;

namespace OpenSkyHRM.Api.Controllers;

public partial class BulkUploadController
{
    private static readonly Regex LoginImportUsernameRegex = new(@"^[A-Za-z0-9@._\-]+$", RegexOptions.Compiled);
    private static readonly string[] LoginEmployeeIdHeaders = ["Employee ID", "Employee Code"];
    private static readonly string[] LoginEmployeeTypeHeaders = ["Employee Type", "Role Code", "Role"];

    [HttpGet("login-template")]
    public async Task<IActionResult> DownloadLoginTemplate()
    {
        using var wb = new XLWorkbook();

        var ws = wb.Worksheets.Count > 0 ? wb.Worksheet(1) : wb.Worksheets.Add("Logins");
        ws.Name = "Logins";
        var cols = new[]
        {
            "Employee ID", "Username", "Password", "Employee Type", "Active", "Must Change Password",
        };
        for (var i = 0; i < cols.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = cols[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0369a1");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        ws.Cell(1, 1).CreateComment();
        ws.Cell(1, 1).GetComment().AddText(
            "Required. The employee's ID (same value as Employee Code in People).");

        ws.Cell(1, 2).CreateComment();
        ws.Cell(1, 2).GetComment().AddText(
            "Required. Unique login username. Letters, digits, @ . _ - only.");

        ws.Cell(1, 3).CreateComment();
        ws.Cell(1, 3).GetComment().AddText(
            "Required. At least 6 characters.");

        ws.Cell(1, 4).CreateComment();
        ws.Cell(1, 4).GetComment().AddText(
            "Required. Use an Employee Type from the EmployeeTypes sheet (e.g. EMPLOYEE, SUPERVISOR, HR_MANAGER, ADMIN).");

        ws.Cell(1, 5).CreateComment();
        ws.Cell(1, 5).GetComment().AddText("Optional. Yes/Y/True/1 or No/N/False/0. Defaults to Yes.");

        ws.Cell(1, 6).CreateComment();
        ws.Cell(1, 6).GetComment().AddText("Optional. Yes/Y/True/1 or No/N/False/0. Defaults to Yes.");

        ws.SheetView.SplitRow = 1;
        ws.Row(1).Height = 22;
        ws.Columns().AdjustToContents(1, 1);

        var roles = await _db.SecurityRoles.AsNoTracking()
            .Where(r => !r.IsDeleted)
            .OrderBy(r => r.Name)
            .Select(r => new { r.Code, r.Name })
            .ToListAsync();

        var typeWs = wb.Worksheets.Add("EmployeeTypes");
        typeWs.Cell(1, 1).Value = "Employee Type";
        typeWs.Cell(1, 2).Value = "Name";
        typeWs.Cell(1, 1).Style.Font.Bold = true;
        typeWs.Cell(1, 2).Style.Font.Bold = true;
        typeWs.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#0369a1");
        typeWs.Cell(1, 2).Style.Fill.BackgroundColor = XLColor.FromHtml("#0369a1");
        typeWs.Cell(1, 1).Style.Font.FontColor = XLColor.White;
        typeWs.Cell(1, 2).Style.Font.FontColor = XLColor.White;
        for (var i = 0; i < roles.Count; i++)
        {
            typeWs.Cell(i + 2, 1).Value = roles[i].Code;
            typeWs.Cell(i + 2, 2).Value = roles[i].Name;
        }

        typeWs.Cell(1, 4).Value = "Active / Must Change Password";
        typeWs.Cell(1, 4).Style.Font.Bold = true;
        typeWs.Cell(2, 4).Value = "Yes, Y, True, or 1 = yes; No, N, False, or 0 = no; blank = default (Yes)";
        typeWs.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "LoginImportTemplate.xlsx");
    }

    [HttpPost("logins")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadLogins(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");
        if (ext == ".xls")
            return BadRequest("Legacy .xls files are not supported. Save the workbook as .xlsx and upload again.");

        var employees = await _db.Employees.AsNoTracking()
            .Where(e => !e.IsDeleted)
            .Select(e => new { e.Id, e.EmployeeCode, e.Email, e.OtherEmail })
            .ToListAsync();
        var empByCode = new Dictionary<string, (Guid Id, string? Email, string? OtherEmail)>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in employees)
        {
            var code = e.EmployeeCode.Trim();
            if (code.Length == 0 || empByCode.ContainsKey(code)) continue;
            empByCode[code] = (e.Id, e.Email, e.OtherEmail);
        }

        var existingUsers = await _db.Users
            .Include(u => u.UserRoles)
            .Where(u => !u.IsDeleted && u.EmployeeId != null)
            .ToListAsync();
        var userByEmployeeId = new Dictionary<Guid, User>();
        foreach (var existing in existingUsers)
        {
            if (existing.EmployeeId is Guid linkedId && !userByEmployeeId.ContainsKey(linkedId))
                userByEmployeeId[linkedId] = existing;
        }

        var usernamesTaken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var un in await _db.Users.AsNoTracking().Select(u => u.Username).ToListAsync())
            usernamesTaken.Add(un);

        var emailsTaken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var em in await _db.Users.AsNoTracking().Select(u => u.Email).ToListAsync())
        {
            if (!string.IsNullOrWhiteSpace(em))
                emailsTaken.Add(em);
        }

        var roles = await _db.SecurityRoles.AsNoTracking()
            .Where(r => !r.IsDeleted)
            .Select(r => new { r.Id, r.Code, r.Name })
            .ToListAsync();
        var roleByCode = new Dictionary<string, (Guid Id, string Code)>(StringComparer.OrdinalIgnoreCase);
        var roleByName = new Dictionary<string, (Guid Id, string Code)>(StringComparer.OrdinalIgnoreCase);
        foreach (var role in roles)
        {
            if (!string.IsNullOrWhiteSpace(role.Code) && !roleByCode.ContainsKey(role.Code))
                roleByCode[role.Code] = (role.Id, role.Code);
            if (!string.IsNullOrWhiteSpace(role.Name) && !roleByName.ContainsKey(role.Name))
                roleByName[role.Name] = (role.Id, role.Code);
        }

        var allowedCreate = await PeopleAccessHelper.GetAllowedEmployeeIdsAsync(User, _db, "Create");

        using var stream = new MemoryStream();
        await file.CopyToAsync(stream);
        stream.Position = 0;
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(stream);
        }
        catch
        {
            return BadRequest("Could not read the Excel file. Download the template, fill the Logins sheet, and upload a .xlsx file.");
        }

        using (wb)
        {
        var ws = TryLoginSheet(wb);
        if (ws is null)
            return BadRequest("Could not find a Logins sheet. Fill the Logins sheet and upload again.");

        var map = BuildLoginHeaderMap(ws);
        if (!HasLoginHeader(map, LoginEmployeeIdHeaders))
            return BadRequest("The Logins sheet must include an Employee ID column.");
        if (!HasLoginHeader(map, "Username"))
            return BadRequest("The Logins sheet must include a Username column.");
        if (!HasLoginHeader(map, "Password"))
            return BadRequest("The Logins sheet must include a Password column.");
        if (!HasLoginHeader(map, LoginEmployeeTypeHeaders))
            return BadRequest("The Logins sheet must include an Employee Type column.");

        var results = new List<LoginRowResult>();
        var created = 0;
        var updated = 0;
        var skipped = 0;
        var last = Math.Min(ws.LastRowUsed()?.RowNumber() ?? 1, 10_000);
        var employeesSeenInFile = new HashSet<Guid>();

        for (var r = 2; r <= last; r++)
        {
            var row = ws.Row(r);
            var code = LoginCell(map, row, LoginEmployeeIdHeaders);
            var usernameRaw = LoginCell(map, row, "Username");
            var passwordRaw = LoginCell(map, row, "Password");
            var typeRaw = LoginCell(map, row, LoginEmployeeTypeHeaders);
            var emailRaw = LoginCell(map, row, "Email");
            var activeRaw = LoginCell(map, row, "Active");
            var mustChangeRaw = LoginCell(map, row, "Must Change Password");

            if (string.IsNullOrWhiteSpace(code)
                && string.IsNullOrWhiteSpace(usernameRaw)
                && string.IsNullOrWhiteSpace(passwordRaw)
                && string.IsNullOrWhiteSpace(typeRaw))
                continue;

            if (string.IsNullOrWhiteSpace(code)
                || string.IsNullOrWhiteSpace(usernameRaw)
                || string.IsNullOrWhiteSpace(passwordRaw)
                || string.IsNullOrWhiteSpace(typeRaw))
            {
                skipped++;
                results.Add(SkipLogin(r, code, usernameRaw, typeRaw,
                    "Employee ID, Username, Password, and Employee Type are all required."));
                continue;
            }

            if (!empByCode.TryGetValue(code.Trim(), out var emp))
            {
                skipped++;
                results.Add(SkipLogin(r, code, usernameRaw, typeRaw, "Employee ID not found."));
                continue;
            }

            if (!await CanLoginAccessEmployeeAsync(User, emp.Id, allowedCreate))
            {
                skipped++;
                results.Add(SkipLogin(r, code, usernameRaw, typeRaw,
                    "No permission to create or update a login for this employee."));
                continue;
            }

            if (employeesSeenInFile.Contains(emp.Id))
            {
                skipped++;
                results.Add(SkipLogin(r, code, usernameRaw, typeRaw,
                    "Employee already processed in this file."));
                continue;
            }

            userByEmployeeId.TryGetValue(emp.Id, out var existingUser);

            var username = usernameRaw.Trim();
            if (username.Length > 100)
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, typeRaw, "Username exceeds 100 characters."));
                continue;
            }

            if (!LoginImportUsernameRegex.IsMatch(username))
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, typeRaw,
                    "Username can only contain letters, numbers, @, ., _, and -."));
                continue;
            }

            if (LoginValueTakenByOther(usernamesTaken, username, existingUser?.Username))
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, typeRaw, $"Username '{username}' is already in use."));
                continue;
            }

            if (passwordRaw.Trim().Length < 6)
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, typeRaw, "Password must be at least 6 characters."));
                continue;
            }

            if (!roleByCode.TryGetValue(typeRaw.Trim(), out var role)
                && !roleByName.TryGetValue(typeRaw.Trim(), out role))
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, typeRaw,
                    $"Employee Type '{typeRaw.Trim()}' was not found. Use a value from the EmployeeTypes sheet."));
                continue;
            }

            string email;
            if (existingUser is not null && string.IsNullOrWhiteSpace(emailRaw))
            {
                email = existingUser.Email;
            }
            else if (!string.IsNullOrWhiteSpace(emailRaw))
            {
                if (!InputValidators.IsValidEmailInput(emailRaw, required: true))
                {
                    skipped++;
                    results.Add(SkipLogin(r, code, username, role.Code, InputValidators.EmailInputValidationMessage));
                    continue;
                }

                email = emailRaw.Trim();
                if (LoginValueTakenByOther(emailsTaken, email, existingUser?.Email))
                {
                    skipped++;
                    results.Add(SkipLogin(r, code, username, role.Code, $"Email '{email}' is already in use."));
                    continue;
                }
            }
            else
            {
                email = ResolveLoginEmail(emp.Email, emp.OtherEmail, code);
                if (LoginValueTakenByOther(emailsTaken, email, existingUser?.Email))
                {
                    var usedEmployeeEmail = !string.IsNullOrWhiteSpace(emp.Email) || !string.IsNullOrWhiteSpace(emp.OtherEmail);
                    if (usedEmployeeEmail)
                    {
                        skipped++;
                        results.Add(SkipLogin(r, code, username, role.Code, $"Email '{email}' is already in use."));
                        continue;
                    }

                    email = $"user-{Guid.NewGuid():N}@noemail.opensky.hrm";
                }
            }

            if (!TryParseLoginFlag(activeRaw, defaultValue: true, out var isActive))
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, role.Code, "Active must be Yes/No, Y/N, True/False, or 1/0."));
                continue;
            }

            if (!TryParseLoginFlag(mustChangeRaw, defaultValue: true, out var mustChange))
            {
                skipped++;
                results.Add(SkipLogin(r, code, username, role.Code,
                    "Must Change Password must be Yes/No, Y/N, True/False, or 1/0."));
                continue;
            }

            User? pendingUser = null;
            try
            {
                if (existingUser is not null)
                {
                    var previousUsername = existingUser.Username;
                    var previousEmail = existingUser.Email;
                    existingUser.Username = username;
                    existingUser.Email = email;
                    existingUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(passwordRaw.Trim());
                    existingUser.MustChangePassword = mustChange;
                    existingUser.IsActive = isActive;
                    var currentRole = existingUser.UserRoles.FirstOrDefault();
                    if (currentRole is null)
                        existingUser.UserRoles.Add(new UserRole { UserId = existingUser.Id, RoleId = role.Id });
                    else if (currentRole.RoleId != role.Id)
                        currentRole.RoleId = role.Id;

                    await _db.SaveChangesAsync();
                    updated++;
                    usernamesTaken.Remove(previousUsername);
                    usernamesTaken.Add(username);
                    if (!string.IsNullOrWhiteSpace(previousEmail))
                        emailsTaken.Remove(previousEmail);
                    emailsTaken.Add(email);
                    employeesSeenInFile.Add(emp.Id);
                    results.Add(new LoginRowResult(r, code.Trim(), username, role.Code, "Updated", [],
                        ["Username and password updated."]));
                }
                else
                {
                    pendingUser = new User
                    {
                        Username = username,
                        Email = email,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(passwordRaw.Trim()),
                        MustChangePassword = mustChange,
                        IsActive = isActive,
                        EmployeeId = emp.Id,
                    };
                    pendingUser.UserRoles.Add(new UserRole { RoleId = role.Id });
                    _db.Users.Add(pendingUser);

                    await _db.SaveChangesAsync();
                    created++;
                    usernamesTaken.Add(username);
                    emailsTaken.Add(email);
                    employeesSeenInFile.Add(emp.Id);
                    results.Add(new LoginRowResult(r, code.Trim(), username, role.Code, "Created", [], null));
                }
            }
            catch (Exception ex)
            {
                if (existingUser is not null)
                    DetachTrackedUser(existingUser);
                if (pendingUser is not null)
                    DetachTrackedUser(pendingUser);
                skipped++;
                results.Add(SkipLogin(r, code, username, role.Code, DescribeLoginSaveFailure(ex)));
            }
        }

        var dataRows = results.Count;
        return Ok(new LoginUploadResult(created, updated, skipped, dataRows, results));
        }
    }

    private static IXLWorksheet? TryLoginSheet(XLWorkbook wb)
    {
        foreach (var s in wb.Worksheets)
        {
            if (string.Equals(s.Name, "Logins", StringComparison.OrdinalIgnoreCase))
                return s;
        }

        foreach (var s in wb.Worksheets)
        {
            var headers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var c = 1; c <= (s.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
            {
                var h = NormalizeImportHeaderKey(GetCellTrimmedDisplayText(s.Cell(1, c)));
                if (!string.IsNullOrEmpty(h)) headers.Add(h);
            }

            if ((headers.Contains("Employee ID") || headers.Contains("Employee Code")) &&
                headers.Contains("Username") &&
                (headers.Contains("Employee Type") || headers.Contains("Role Code")))
                return s;
        }

        return wb.Worksheets.FirstOrDefault();
    }

    private static Dictionary<string, int> BuildLoginHeaderMap(IXLWorksheet ws)
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

    private static bool HasLoginHeader(Dictionary<string, int> map, params string[] cols)
        => cols.Any(col => map.ContainsKey(NormalizeImportHeaderKey(col)));

    private static string? LoginCell(Dictionary<string, int> map, IXLRow row, params string[] cols)
    {
        foreach (var col in cols)
        {
            if (!map.TryGetValue(NormalizeImportHeaderKey(col), out var c)) continue;
            return GetCellTrimmedDisplayText(row.Cell(c));
        }

        return null;
    }

    private async Task<bool> CanLoginAccessEmployeeAsync(ClaimsPrincipal user, Guid employeeId,
        IReadOnlyList<Guid>? allowedIds)
    {
        if (allowedIds is not null && !allowedIds.Contains(employeeId))
            return false;
        return await PeopleAccessHelper.CanAccessEmployeeAsync(user, _db, employeeId, "Create");
    }

    private static string ResolveLoginEmail(string? workEmail, string? otherEmail, string employeeCode)
    {
        if (!string.IsNullOrWhiteSpace(workEmail)) return workEmail.Trim();
        if (!string.IsNullOrWhiteSpace(otherEmail)) return otherEmail.Trim();
        var segment = employeeCode.Trim().ToLowerInvariant();
        segment = new string(segment.Where(c => char.IsLetterOrDigit(c) || c is '.' or '_' or '-').ToArray());
        if (string.IsNullOrEmpty(segment))
            segment = Guid.NewGuid().ToString("N")[..12];
        return $"{segment}@noemail.opensky.hrm";
    }

    private static bool TryParseLoginFlag(string? raw, bool defaultValue, out bool value)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            value = defaultValue;
            return true;
        }

        switch (raw.Trim().ToLowerInvariant())
        {
            case "yes":
            case "y":
            case "true":
            case "1":
                value = true;
                return true;
            case "no":
            case "n":
            case "false":
            case "0":
                value = false;
                return true;
            default:
                value = defaultValue;
                return false;
        }
    }

    private static bool LoginValueTakenByOther(HashSet<string> taken, string value, string? currentValue)
    {
        if (!taken.Contains(value)) return false;
        return string.IsNullOrWhiteSpace(currentValue)
            || !string.Equals(value, currentValue, StringComparison.OrdinalIgnoreCase);
    }

    private static string DescribeLoginSaveFailure(Exception ex)
    {
        for (var inner = ex; inner != null; inner = inner.InnerException!)
        {
            if (inner is PostgresException pg)
            {
                if (pg.SqlState == "23505")
                    return "Could not save login (duplicate username or email).";
                if (pg.SqlState == "22001")
                    return "A login value exceeds the maximum allowed length.";
            }

            if (inner.Message.Contains("timestamp", StringComparison.OrdinalIgnoreCase)
                && inner.Message.Contains("DateTime", StringComparison.OrdinalIgnoreCase))
                return "Could not update login because of a date/time value. Try again, or reset the user from User management.";
        }

        return "Could not save login. Check username, password, and employee type, then try again.";
    }

    private static LoginRowResult SkipLogin(int row, string? employeeCode, string? username, string? employeeType, string error)
        => new(row, employeeCode?.Trim() ?? "", username?.Trim() ?? "", employeeType?.Trim() ?? "", "Skipped", [error]);

    public record LoginRowResult(
        int Row,
        string EmployeeCode,
        string Username,
        string EmployeeType,
        string Status,
        List<string> Errors,
        List<string>? Notes = null);

    public record LoginUploadResult(int Created, int Updated, int Skipped, int TotalRows, List<LoginRowResult> Results);
}
