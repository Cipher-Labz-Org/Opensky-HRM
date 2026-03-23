using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BulkUploadController : ControllerBase
{
    private readonly AppDbContext _db;

    public BulkUploadController(AppDbContext db) => _db = db;

    [HttpGet("template")]
    public IActionResult DownloadTemplate()
    {
        using var wb = new XLWorkbook();

        var ws = wb.Worksheets.Add("Employees");
        var cols = GetEmployeeColumns();
        for (int i = 0; i < cols.Length; i++)
        {
            ws.Cell(1, i + 1).Value = cols[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1e40af");
            ws.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
        }
        ws.Columns().AdjustToContents(1, 1);

        AddLookupSheet(wb, "Departments", _db.Departments.Where(d => !d.IsDeleted).Select(d => new { d.Name }).ToList().Select(d => d.Name));
        AddLookupSheet(wb, "BusinessUnits", _db.BusinessUnits.Where(b => !b.IsDeleted).Select(b => new { b.Name }).ToList().Select(b => b.Name));
        AddLookupSheet(wb, "Grades", _db.Grades.Where(g => !g.IsDeleted).Select(g => new { g.Name }).ToList().Select(g => g.Name));
        AddLookupSheet(wb, "Locations", _db.Locations.Where(l => !l.IsDeleted).Select(l => new { l.Name }).ToList().Select(l => l.Name));
        AddLookupSheet(wb, "JobTitles", _db.JobTitles.Where(j => !j.IsDeleted).Select(j => new { j.Title }).ToList().Select(j => j.Title));

        var refWs = wb.Worksheets.Add("Reference");
        refWs.Cell(1, 1).Value = "Gender Options";
        refWs.Cell(1, 1).Style.Font.Bold = true;
        var genders = new[] { "Male", "Female", "Other" };
        for (int i = 0; i < genders.Length; i++) refWs.Cell(i + 2, 1).Value = genders[i];

        refWs.Cell(1, 2).Value = "Employment Status";
        refWs.Cell(1, 2).Style.Font.Bold = true;
        var statuses = Enum.GetNames<EmploymentStatus>();
        for (int i = 0; i < statuses.Length; i++) refWs.Cell(i + 2, 2).Value = statuses[i];

        refWs.Cell(1, 3).Value = "Marital Status";
        refWs.Cell(1, 3).Style.Font.Bold = true;
        var marital = new[] { "Single", "Married", "Divorced", "Widowed", "Separated" };
        for (int i = 0; i < marital.Length; i++) refWs.Cell(i + 2, 3).Value = marital[i];

        refWs.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "EmployeeImportTemplate.xlsx");
    }

    [HttpPost("employees")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadEmployees(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");

        var departments = await _db.Departments.Where(d => !d.IsDeleted).ToListAsync();
        var businessUnits = await _db.BusinessUnits.Where(b => !b.IsDeleted).ToListAsync();
        var grades = await _db.Grades.Where(g => !g.IsDeleted).ToListAsync();
        var locations = await _db.Locations.Where(l => !l.IsDeleted).ToListAsync();
        var jobTitles = await _db.JobTitles.Where(j => !j.IsDeleted).ToListAsync();
        var existingCodes = await _db.Employees.Select(e => e.EmployeeCode).ToListAsync();

        var results = new List<RowResult>();
        int created = 0;
        int skipped = 0;

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);
        var cols = GetEmployeeColumns();

        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int c = 1; c <= (ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
        {
            var header = ws.Cell(1, c).GetString().Trim();
            if (!string.IsNullOrEmpty(header))
                headerMap[header] = c;
        }

        string? Cell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(colName, out int c)) return null;
            var val = row.Cell(c).GetString().Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        DateTime? DateCell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(colName, out int c)) return null;
            var cell = row.Cell(c);
            if (cell.DataType == XLDataType.DateTime) return cell.GetDateTime();
            var s = cell.GetString().Trim();
            if (DateTime.TryParse(s, out var dt)) return dt;
            return null;
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            var errors = new List<string>();

            var firstName = Cell(row, "First Name");
            var lastName = Cell(row, "Last Name");
            var email = Cell(row, "Email");
            var deptName = Cell(row, "Department");
            var genderStr = Cell(row, "Gender");
            var dobStr = DateCell(row, "Date of Birth");
            var joinStr = DateCell(row, "Joined Date");

            if (string.IsNullOrEmpty(firstName)) errors.Add("First Name is required");
            if (string.IsNullOrEmpty(lastName)) errors.Add("Last Name is required");
            if (string.IsNullOrEmpty(email)) errors.Add("Email is required");
            if (string.IsNullOrEmpty(deptName)) errors.Add("Department is required");
            if (dobStr is null) errors.Add("Date of Birth is required");
            if (joinStr is null) errors.Add("Joined Date is required");

            var dept = departments.FirstOrDefault(d => d.Name.Equals(deptName, StringComparison.OrdinalIgnoreCase));
            if (dept is null && !string.IsNullOrEmpty(deptName)) errors.Add($"Department '{deptName}' not found");

            Gender gender = Gender.Male;
            if (!string.IsNullOrEmpty(genderStr))
            {
                if (!Enum.TryParse(genderStr, true, out gender))
                    errors.Add($"Invalid Gender '{genderStr}'");
            }

            var status = "FullTimePermanent";
            var statusStr = Cell(row, "Employment Status");
            if (!string.IsNullOrEmpty(statusStr))
            {
                status = statusStr;
            }

            var empCode = Cell(row, "Employee Code");
            if (!string.IsNullOrEmpty(empCode) && existingCodes.Contains(empCode))
                errors.Add($"Employee Code '{empCode}' already exists");

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, errors));
                continue;
            }

            if (string.IsNullOrEmpty(empCode))
                empCode = await GenerateNextCode(existingCodes);

            var buName = Cell(row, "Business Unit");
            var bu = buName != null ? businessUnits.FirstOrDefault(b => b.Name.Equals(buName, StringComparison.OrdinalIgnoreCase)) : null;
            var gradeName = Cell(row, "Grade");
            var grade = gradeName != null ? grades.FirstOrDefault(g => g.Name.Equals(gradeName, StringComparison.OrdinalIgnoreCase)) : null;
            var locName = Cell(row, "Location");
            var loc = locName != null ? locations.FirstOrDefault(l => l.Name.Equals(locName, StringComparison.OrdinalIgnoreCase)) : null;
            var jtName = Cell(row, "Job Title");
            var jt = jtName != null ? jobTitles.FirstOrDefault(j => j.Title.Equals(jtName, StringComparison.OrdinalIgnoreCase)) : null;

            var employee = new Employee
            {
                EmployeeCode = empCode!,
                FirstName = firstName!,
                MiddleName = Cell(row, "Middle Name"),
                LastName = lastName!,
                Email = email!,
                Phone = Cell(row, "Phone"),
                DateOfBirth = DateTime.SpecifyKind(dobStr!.Value, DateTimeKind.Utc),
                Gender = gender,
                JoinDate = DateTime.SpecifyKind(joinStr!.Value, DateTimeKind.Utc),
                Status = status,
                DepartmentId = dept!.Id,
                BusinessUnitId = bu?.Id,
                GradeId = grade?.Id,
                LocationId = loc?.Id,
                JobTitleId = jt?.Id,
                MaritalStatus = Cell(row, "Marital Status"),
                Nationality = Cell(row, "Nationality"),
                Religion = Cell(row, "Religion"),
                Ethnicity = Cell(row, "Ethnicity"),
                NationalId = Cell(row, "National ID"),
                OtherId = Cell(row, "Other ID"),
                TinNumber = Cell(row, "TIN Number"),
                EpfNumber = Cell(row, "EPF Number"),
                EtfNumber = Cell(row, "ETF Number"),
                DriversLicenseNumber = Cell(row, "Driver License Number"),
                LicenseExpiryDate = DateCell(row, "License Expiry Date") is DateTime led ? DateTime.SpecifyKind(led, DateTimeKind.Utc) : null,
                DriversLicenseIssuingCountry = Cell(row, "License Issuing Country"),
                HomeTelephone = Cell(row, "Home Telephone"),
                WorkTelephone = Cell(row, "Work Telephone"),
                OtherEmail = Cell(row, "Personal Email"),
                AddressStreet1 = Cell(row, "Address Street 1"),
                AddressStreet2 = Cell(row, "Address Street 2"),
                City = Cell(row, "City"),
                Country = Cell(row, "Country"),
                StateProvince = Cell(row, "State/Province"),
                ZipPostalCode = Cell(row, "Zip/Postal Code"),
                PollingDivision = Cell(row, "Polling Division"),
                DistanceToOffice = Cell(row, "Distance to Office"),
                ModeOfTransport = Cell(row, "Mode of Transport"),
                PermanentStreet1 = Cell(row, "Permanent Street 1"),
                PermanentStreet2 = Cell(row, "Permanent Street 2"),
                PermanentCity = Cell(row, "Permanent City"),
                PermanentCountry = Cell(row, "Permanent Country"),
                PermanentStateProvince = Cell(row, "Permanent State/Province"),
                PermanentZipPostalCode = Cell(row, "Permanent Zip/Postal Code"),
                PermanentPollingDivision = Cell(row, "Permanent Polling Division"),
                PermanentDistanceToOffice = Cell(row, "Permanent Distance to Office"),
                ProbationEndDate = DateCell(row, "Probation End Date") is DateTime ped ? DateTime.SpecifyKind(ped, DateTimeKind.Utc) : null,
                DateOfPermanency = DateCell(row, "Date of Permanency") is DateTime dop ? DateTime.SpecifyKind(dop, DateTimeKind.Utc) : null,
            };

            _db.Employees.Add(employee);
            existingCodes.Add(empCode!);
            created++;
            results.Add(new RowResult(r, firstName!, lastName!, true, new List<string>()));
        }

        await _db.SaveChangesAsync();

        return Ok(new UploadResult(created, skipped, lastRow - 1, results));
    }

    private async Task<string> GenerateNextCode(List<string> existingCodes)
    {
        var prefix = "EMP";
        var length = 6;
        var settingPrefix = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "EmployeeCodePrefix");
        var settingLength = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == "EmployeeCodeLength");
        if (settingPrefix != null) prefix = settingPrefix.Value;
        if (settingLength != null && int.TryParse(settingLength.Value, out var l)) length = l;

        int max = 0;
        foreach (var code in existingCodes)
        {
            var numPart = code.Contains('-') ? code[(code.LastIndexOf('-') + 1)..] : code;
            if (int.TryParse(numPart, out var n) && n > max) max = n;
        }

        var next = (max + 1).ToString().PadLeft(length, '0');
        return $"{prefix}-{next}";
    }

    private static string[] GetEmployeeColumns() => new[]
    {
        "Employee Code",
        "First Name",
        "Middle Name",
        "Last Name",
        "Email",
        "Phone",
        "Gender",
        "Date of Birth",
        "Joined Date",
        "Employment Status",
        "Department",
        "Business Unit",
        "Grade",
        "Job Title",
        "Location",
        "Marital Status",
        "Nationality",
        "Religion",
        "Ethnicity",
        "National ID",
        "Other ID",
        "TIN Number",
        "EPF Number",
        "ETF Number",
        "Driver License Number",
        "License Expiry Date",
        "License Issuing Country",
        "Home Telephone",
        "Work Telephone",
        "Personal Email",
        "Probation End Date",
        "Date of Permanency",
        "Address Street 1",
        "Address Street 2",
        "City",
        "Country",
        "State/Province",
        "Zip/Postal Code",
        "Polling Division",
        "Distance to Office",
        "Mode of Transport",
        "Permanent Street 1",
        "Permanent Street 2",
        "Permanent City",
        "Permanent Country",
        "Permanent State/Province",
        "Permanent Zip/Postal Code",
        "Permanent Polling Division",
        "Permanent Distance to Office",
    };

    private static void AddLookupSheet(XLWorkbook wb, string name, IEnumerable<string> values)
    {
        var ws = wb.Worksheets.Add(name);
        ws.Cell(1, 1).Value = name;
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#059669");
        ws.Cell(1, 1).Style.Font.FontColor = XLColor.White;
        int r = 2;
        foreach (var v in values)
            ws.Cell(r++, 1).Value = v;
        ws.Column(1).AdjustToContents();
    }

    // ───── Leave Balance Upload ─────

    [HttpGet("leave-balance-template")]
    public IActionResult DownloadLeaveBalanceTemplate()
    {
        using var wb = new XLWorkbook();

        var ws = wb.Worksheets.Add("LeaveBalances");
        var cols = new[] { "Employee Code", "Leave Type", "Year", "Entitled", "Used", "Carried Forward" };
        for (int i = 0; i < cols.Length; i++)
        {
            ws.Cell(1, i + 1).Value = cols[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            ws.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
        }
        ws.Columns().AdjustToContents(1, 1);

        var empSheet = wb.Worksheets.Add("Employees");
        empSheet.Cell(1, 1).Value = "Employee Code";
        empSheet.Cell(1, 2).Value = "Employee Name";
        empSheet.Cell(1, 1).Style.Font.Bold = true;
        empSheet.Cell(1, 2).Style.Font.Bold = true;
        empSheet.Cell(1, 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#059669");
        empSheet.Cell(1, 2).Style.Fill.BackgroundColor = XLColor.FromHtml("#059669");
        empSheet.Cell(1, 1).Style.Font.FontColor = XLColor.White;
        empSheet.Cell(1, 2).Style.Font.FontColor = XLColor.White;
        var employees = _db.Employees.Where(e => !e.IsDeleted).OrderBy(e => e.EmployeeCode)
            .Select(e => new { e.EmployeeCode, e.FirstName, e.LastName }).ToList();
        for (int i = 0; i < employees.Count; i++)
        {
            empSheet.Cell(i + 2, 1).Value = employees[i].EmployeeCode;
            empSheet.Cell(i + 2, 2).Value = $"{employees[i].FirstName} {employees[i].LastName}";
        }
        empSheet.Columns().AdjustToContents();

        AddLookupSheet(wb, "LeaveTypes",
            _db.LeaveTypes.Where(lt => !lt.IsDeleted && lt.IsActive)
                .OrderBy(lt => lt.Name)
                .Select(lt => new { lt.Name }).ToList().Select(lt => lt.Name));

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "LeaveBalanceImportTemplate.xlsx");
    }

    [HttpPost("leave-balances")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadLeaveBalances(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");

        var employees = await _db.Employees.Where(e => !e.IsDeleted)
            .Select(e => new { e.Id, e.EmployeeCode, e.FirstName, e.LastName }).ToListAsync();
        var leaveTypes = await _db.LeaveTypes.Where(lt => !lt.IsDeleted && lt.IsActive).ToListAsync();
        var existingBalances = await _db.LeaveBalances.ToListAsync();

        var results = new List<LeaveBalanceRowResult>();
        int created = 0, updated = 0, skipped = 0;

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheet(1);

        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int c = 1; c <= (ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
        {
            var header = ws.Cell(1, c).GetString().Trim();
            if (!string.IsNullOrEmpty(header))
                headerMap[header] = c;
        }

        string? Cell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(colName, out int c)) return null;
            var val = row.Cell(c).GetString().Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        decimal? DecCell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(colName, out int c)) return null;
            var cell = row.Cell(c);
            if (cell.DataType == XLDataType.Number) return (decimal)cell.GetDouble();
            var s = cell.GetString().Trim();
            if (decimal.TryParse(s, out var d)) return d;
            return null;
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            var errors = new List<string>();

            var empCode = Cell(row, "Employee Code");
            var leaveTypeName = Cell(row, "Leave Type");
            var yearStr = Cell(row, "Year");
            var entitled = DecCell(row, "Entitled");
            var used = DecCell(row, "Used");
            var carried = DecCell(row, "Carried Forward");

            if (string.IsNullOrEmpty(empCode)) errors.Add("Employee Code is required");
            if (string.IsNullOrEmpty(leaveTypeName)) errors.Add("Leave Type is required");
            if (string.IsNullOrEmpty(yearStr) || !int.TryParse(yearStr, out var year)) { errors.Add("Valid Year is required"); year = 0; }
            if (entitled is null) errors.Add("Entitled is required");

            var emp = employees.FirstOrDefault(e => e.EmployeeCode.Equals(empCode, StringComparison.OrdinalIgnoreCase));
            if (emp is null && !string.IsNullOrEmpty(empCode)) errors.Add($"Employee '{empCode}' not found");

            var lt = leaveTypes.FirstOrDefault(t => t.Name.Equals(leaveTypeName, StringComparison.OrdinalIgnoreCase));
            if (lt is null && !string.IsNullOrEmpty(leaveTypeName)) errors.Add($"Leave Type '{leaveTypeName}' not found");

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new LeaveBalanceRowResult(r, empCode ?? "", leaveTypeName ?? "", "Skipped", errors));
                continue;
            }

            var existing = existingBalances.FirstOrDefault(b =>
                b.EmployeeId == emp!.Id && b.LeaveTypeId == lt!.Id && b.Year == year);

            if (existing != null)
            {
                existing.Entitled = entitled!.Value;
                existing.Used = used ?? 0;
                existing.CarriedForward = carried ?? 0;
                updated++;
                results.Add(new LeaveBalanceRowResult(r, empCode!, leaveTypeName!, "Updated", new List<string>()));
            }
            else
            {
                var balance = new LeaveBalance
                {
                    EmployeeId = emp!.Id,
                    LeaveTypeId = lt!.Id,
                    Year = year,
                    Entitled = entitled!.Value,
                    Used = used ?? 0,
                    CarriedForward = carried ?? 0,
                };
                _db.LeaveBalances.Add(balance);
                existingBalances.Add(balance);
                created++;
                results.Add(new LeaveBalanceRowResult(r, empCode!, leaveTypeName!, "Created", new List<string>()));
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new LeaveBalanceUploadResult(created, updated, skipped, lastRow - 1, results));
    }

    public record RowResult(int Row, string FirstName, string LastName, bool Success, List<string> Errors);
    public record UploadResult(int Created, int Skipped, int TotalRows, List<RowResult> Results);
    public record LeaveBalanceRowResult(int Row, string EmployeeCode, string LeaveType, string Status, List<string> Errors);
    public record LeaveBalanceUploadResult(int Created, int Updated, int Skipped, int TotalRows, List<LeaveBalanceRowResult> Results);
}
