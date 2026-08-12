using System.Globalization;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Administration")]
// One route only: `api/[controller]` + `api/bulkupload` both resolve to the same path case-insensitively → AmbiguousMatchException.
[Route("api/bulkupload")]
public partial class BulkUploadController : ControllerBase
{
    /// <summary>Default password for users created via bulk import when <c>Create employee logins</c> is enabled (must match Administration UI).</summary>
    public const string BulkImportDefaultLoginPassword = "123";

    private const int MaxEmployeeCodeLength = 50;
    private const int MaxEmployeePhoneLength = 100;
    private const int MaxEmployeeZipLength = 40;

    private readonly AppDbContext _db;

    public BulkUploadController(AppDbContext db) => _db = db;

    [HttpGet("template")]
    public async Task<IActionResult> DownloadTemplate()
    {
        using var wb = new XLWorkbook();

        var employmentTypeCodes = await _db.EmploymentStatusTypes
            .AsNoTracking()
            .Where(t => !t.IsDeleted && t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => t.Code)
            .ToListAsync();
        if (employmentTypeCodes.Count == 0)
            employmentTypeCodes = Enum.GetNames<EmploymentType>().ToList();

        var employeeStatusCodes = await _db.EmployeeStatusTypes
            .AsNoTracking()
            .Where(t => !t.IsDeleted && t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => t.Code)
            .ToListAsync();
        if (employeeStatusCodes.Count == 0)
            employeeStatusCodes = Enum.GetNames<EmployeeStatus>().ToList();

        var ws = wb.Worksheets.Add("Employees");
        var cols = GetEmployeeColumns();
        for (int i = 0; i < cols.Length; i++)
        {
            ws.Cell(1, i + 1).Value = cols[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#1e40af");
            ws.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
        }

        var employeeCodeColIndex = Array.FindIndex(cols, static c => string.Equals(c, "Employee Code", StringComparison.OrdinalIgnoreCase));
        if (employeeCodeColIndex >= 0)
        {
            var ec = ws.Cell(1, employeeCodeColIndex + 1);
            ec.CreateComment();
            ec.GetComment().AddText(
                "Leave blank to auto-generate a unique employee code (employee only — no login). When \"Create employee logins\" is enabled, enter Employee Code on rows that need a login; that code becomes the username (letters, digits, . _ - only; unique).");
        }

        var fingerprintIdColIndex = Array.FindIndex(cols, static c => string.Equals(c, "Fingerprint ID", StringComparison.OrdinalIgnoreCase));
        if (fingerprintIdColIndex >= 0)
        {
            var fc = ws.Cell(1, fingerprintIdColIndex + 1);
            fc.CreateComment();
            fc.GetComment().AddText(
                "Optional. Device PIN / user ID from the fingerprint machine when it differs from Employee Code. Leave blank if the machine ID matches Employee Code. Must be unique when set.");
        }

        ws.Columns().AdjustToContents(1, 1);

        AddLookupSheet(wb, "Departments", _db.Departments.Where(d => !d.IsDeleted).Select(d => new { d.Name }).ToList().Select(d => d.Name));
        AddLookupSheet(wb, "BusinessUnits", _db.BusinessUnits.Where(b => !b.IsDeleted).Select(b => new { b.Name }).ToList().Select(b => b.Name));
        AddLookupSheet(wb, "Grades", _db.Grades.Where(g => !g.IsDeleted).Select(g => new { g.Name }).ToList().Select(g => g.Name));
        AddLookupSheet(wb, "Locations", _db.Locations.Where(l => !l.IsDeleted).Select(l => new { l.Name }).ToList().Select(l => l.Name));
        AddLookupSheet(wb, "JobTitles", _db.JobTitles.Where(j => !j.IsDeleted).Select(j => new { j.Title }).ToList().Select(j => j.Title));
        AddLookupSheet(wb, "PositionCodes", _db.Positions.Where(p => !p.IsDeleted).OrderBy(p => p.Code).Select(p => p.Code).ToList());
        AddLookupSheet(wb, "ShiftPatternCodes", _db.ShiftPatterns.Where(s => !s.IsDeleted).OrderBy(s => s.Code).Select(s => s.Code).ToList());

        var refWs = wb.Worksheets.Add("Reference");
        refWs.Cell(1, 1).Value = "Gender Options";
        refWs.Cell(1, 1).Style.Font.Bold = true;
        var genders = new[] { "Male", "Female", "Other" };
        for (int i = 0; i < genders.Length; i++) refWs.Cell(i + 2, 1).Value = genders[i];

        refWs.Cell(1, 2).Value = "Employment Type (code)";
        refWs.Cell(1, 2).Style.Font.Bold = true;
        for (int i = 0; i < employmentTypeCodes.Count; i++) refWs.Cell(i + 2, 2).Value = employmentTypeCodes[i];

        refWs.Cell(1, 3).Value = "Marital Status";
        refWs.Cell(1, 3).Style.Font.Bold = true;
        var marital = new[] { "Single", "Married", "Divorced", "Widowed", "Separated" };
        for (int i = 0; i < marital.Length; i++) refWs.Cell(i + 2, 3).Value = marital[i];

        refWs.Cell(1, 4).Value = "Employee Status (code)";
        refWs.Cell(1, 4).Style.Font.Bold = true;
        for (int i = 0; i < employeeStatusCodes.Count; i++) refWs.Cell(i + 2, 4).Value = employeeStatusCodes[i];

        refWs.Cell(1, 5).Value = "Is Top of Hierarchy";
        refWs.Cell(1, 5).Style.Font.Bold = true;
        refWs.Cell(2, 5).Value = "Yes, Y, True, or 1 = top; blank or other = no";

        refWs.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        ms.Position = 0;
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "EmployeeImportTemplate.xlsx");
    }

    [HttpPost("employees")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> UploadEmployees(IFormFile file, [FromForm] string? createUserLogins = null)
    {
        try
        {
            return await UploadEmployeesCoreAsync(file, createUserLogins);
        }
        catch (DbUpdateException ex)
        {
            return MapEmployeeImportDbUpdateException(ex);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "Employee import failed unexpectedly. Try the downloaded template, a smaller batch, or contact support.",
                detail = ex.Message,
            });
        }
    }

    private async Task<IActionResult> UploadEmployeesCoreAsync(IFormFile file, string? createUserLogins)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");
        if (ext == ".xls")
            return BadRequest("Legacy .xls files are not supported. Save the workbook as .xlsx and upload again.");

        var wantLogins = string.Equals(createUserLogins, "true", StringComparison.OrdinalIgnoreCase);
        var loginJobs = new List<(int Row, Employee Emp, string EmployeeCodeForLogin)>();
        var reservedSheetUsernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var usernamesTaken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var un in await _db.Users.AsNoTracking().Where(u => !u.IsDeleted).Select(u => u.Username).ToListAsync())
            usernamesTaken.Add(un);

        var departments = await _db.Departments.Where(d => !d.IsDeleted).ToListAsync();
        var businessUnits = await _db.BusinessUnits.Where(b => !b.IsDeleted).ToListAsync();
        var grades = await _db.Grades.Where(g => !g.IsDeleted).ToListAsync();
        var locations = await _db.Locations.Where(l => !l.IsDeleted).ToListAsync();
        var jobTitles = await _db.JobTitles.Where(j => !j.IsDeleted).ToListAsync();
        var positions = await _db.Positions.Where(p => !p.IsDeleted).ToListAsync();
        var shiftPatterns = await _db.ShiftPatterns.Where(s => !s.IsDeleted).ToListAsync();

        var employmentTypeCanonical = await BuildEmploymentTypeCodeMapAsync(_db);
        var employeeStatusCanonical = await BuildEmployeeStatusCodeMapAsync(_db);
        var defaultEmploymentTypeCode = await _db.EmploymentStatusTypes.AsNoTracking()
            .Where(t => !t.IsDeleted && t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => t.Code)
            .FirstOrDefaultAsync() ?? nameof(EmploymentType.FullTimePermanent);
        var defaultEmployeeStatusCode = await _db.EmployeeStatusTypes.AsNoTracking()
            .Where(t => !t.IsDeleted && t.IsActive)
            .OrderBy(t => t.SortOrder).ThenBy(t => t.Name)
            .Select(t => t.Code)
            .FirstOrDefaultAsync() ?? nameof(EmployeeStatus.Active);

        var existingEmployees = await _db.Employees.AsNoTracking().Where(e => !e.IsDeleted)
            .Select(e => new { e.Id, e.EmployeeCode }).ToListAsync();
        // Unique indexes apply to all rows (including soft-deleted); match that when validating codes and emails.
        var allEmployeeCodes = await _db.Employees.AsNoTracking().IgnoreQueryFilters()
            .Select(e => e.EmployeeCode).ToListAsync();
        var reservedEmployeeCodes = new HashSet<string>(allEmployeeCodes, StringComparer.OrdinalIgnoreCase);
        var existingCodesForGeneration = new List<string>(allEmployeeCodes);
        var (employeeCodePrefix, employeeCodeNumericLength) = await ReadEmployeeCodeGenerationSettingsAsync();
        // Unique index IX_Employees_Email applies to all rows (including soft-deleted); match that when validating.
        var existingEmails = await _db.Employees.AsNoTracking().IgnoreQueryFilters()
            .Where(e => e.Email != null && e.Email != "")
            .Select(e => e.Email!)
            .ToListAsync();
        var existingEmailSet = new HashSet<string>(existingEmails.Select(e => e.Trim()), StringComparer.OrdinalIgnoreCase);
        var emailsSeenInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var existingFingerprintIds = await _db.Employees.AsNoTracking().IgnoreQueryFilters()
            .Where(e => e.FingerprintId != null && e.FingerprintId != "")
            .Select(e => e.FingerprintId!)
            .ToListAsync();
        var existingFingerprintSet = new HashSet<string>(
            existingFingerprintIds.Select(f => f.Trim()).Where(f => f.Length > 0),
            StringComparer.OrdinalIgnoreCase);
        var fingerprintsSeenInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var managerLookup = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var e in existingEmployees)
        {
            if (!managerLookup.ContainsKey(e.EmployeeCode))
                managerLookup[e.EmployeeCode] = e.Id;
        }

        var results = new List<RowResult>();
        int created = 0;
        int skipped = 0;

        using var stream = file.OpenReadStream();
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(stream);
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                message = "Could not read the Excel file. Download the employee template from this page, fill it in, and save as .xlsx.",
                detail = ex.Message,
            });
        }

        using (wb)
        {
        var ws = GetEmployeeImportWorksheet(wb);

        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        for (int c = 1; c <= lastCol; c++)
        {
            var rawHeader = GetCellTrimmedDisplayText(ws.Cell(1, c));
            if (string.IsNullOrEmpty(rawHeader)) continue;
            var key = NormalizeImportHeaderKey(rawHeader);
            if (string.IsNullOrEmpty(key)) continue;
            headerMap[key] = c;
        }

        string? Cell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return null;
            return GetCellTrimmedDisplayText(row.Cell(c));
        }

        string? CellAny(IXLRow row, params string[] colNames)
        {
            foreach (var colName in colNames)
            {
                var v = Cell(row, colName);
                if (v != null) return v;
            }
            return null;
        }

        DateTime? DateCell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return null;
            var cell = row.Cell(c);
            if (cell.DataType == XLDataType.DateTime) return cell.GetDateTime();
            if (cell.DataType == XLDataType.Number && cell.TryGetValue<double>(out var oaDate))
            {
                try
                {
                    if (oaDate >= 1 && oaDate < 2958466)
                        return DateTime.FromOADate(oaDate);
                }
                catch (ArgumentException)
                {
                    /* fall through to text parse */
                }
            }

            var s = GetCellTrimmedDisplayText(cell);
            if (string.IsNullOrEmpty(s)) return null;
            if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var dt)) return dt;
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt)) return dt;
            return null;
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            var errors = new List<string>();

            var firstName = Cell(row, "First Name");
            var lastName = Cell(row, "Last Name");
            var emailWork = Cell(row, "Email");
            var deptName = Cell(row, "Department");
            var genderStr = Cell(row, "Gender");
            var dobStr = DateCell(row, "Date of Birth");
            var joinStr = DateCell(row, "Joined Date");

            if (string.IsNullOrEmpty(firstName)) errors.Add("First Name is required");
            if (string.IsNullOrEmpty(lastName)) errors.Add("Last Name is required");
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

            var employmentType = defaultEmploymentTypeCode;
            var employmentTypeStr = CellAny(row, "Employment Type", "Employment Status");
            if (!string.IsNullOrEmpty(employmentTypeStr))
            {
                if (!employmentTypeCanonical.TryGetValue(employmentTypeStr.Trim(), out var canonEmpType))
                    errors.Add($"Invalid Employment Type '{employmentTypeStr}' (use Reference column B — codes from Administration → Organization, or legacy enum names)");
                else
                    employmentType = canonEmpType;
            }

            var empCodeRaw = Cell(row, "Employee Code");
            var empCodeFromSheet = !string.IsNullOrEmpty(empCodeRaw);
            var empCode = empCodeRaw;
            if (!string.IsNullOrEmpty(empCode) && empCode.Length > MaxEmployeeCodeLength)
                errors.Add($"Employee Code must be at most {MaxEmployeeCodeLength} characters (this row has {empCode.Length}).");
            if (!string.IsNullOrEmpty(empCode) && reservedEmployeeCodes.Contains(empCode))
                errors.Add($"Employee Code '{empCode}' already exists (including terminated or removed employees). Use a different code.");

            var posCodeRaw = Cell(row, "Position Code");
            Position? position = null;
            if (!string.IsNullOrEmpty(posCodeRaw))
            {
                position = positions.FirstOrDefault(p => p.Code.Equals(posCodeRaw, StringComparison.OrdinalIgnoreCase))
                    ?? positions.FirstOrDefault(p => p.Title.Equals(posCodeRaw, StringComparison.OrdinalIgnoreCase));
                if (position is null)
                    errors.Add($"Position Code '{posCodeRaw}' not found (use Position Code or Title from master data)");
            }

            var shiftCodeRaw = Cell(row, "Shift Pattern Code");
            ShiftPattern? shiftPattern = null;
            if (!string.IsNullOrEmpty(shiftCodeRaw))
            {
                shiftPattern = shiftPatterns.FirstOrDefault(s => s.Code.Equals(shiftCodeRaw, StringComparison.OrdinalIgnoreCase))
                    ?? shiftPatterns.FirstOrDefault(s => s.Name.Equals(shiftCodeRaw, StringComparison.OrdinalIgnoreCase));
                if (shiftPattern is null)
                    errors.Add($"Shift Pattern Code '{shiftCodeRaw}' not found (use Code or Name from master data)");
            }

            var mgrCodeRaw = Cell(row, "Manager Employee Code");
            Guid? managerId = null;
            if (!string.IsNullOrEmpty(mgrCodeRaw))
            {
                if (!managerLookup.TryGetValue(mgrCodeRaw, out var mgrIdFound))
                    errors.Add($"Manager Employee Code '{mgrCodeRaw}' not found (must be an existing employee code, or appear earlier in this file)");
                else
                    managerId = mgrIdFound;
            }

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, errors));
                continue;
            }

            if (string.IsNullOrEmpty(empCode))
                empCode = GenerateNextEmployeeCode(
                    existingCodesForGeneration,
                    reservedEmployeeCodes,
                    employeeCodePrefix,
                    employeeCodeNumericLength);

            if (wantLogins && empCodeFromSheet)
            {
                var usernameNorm = NormalizeUsernameCandidate(empCode);
                if (string.IsNullOrEmpty(usernameNorm))
                    errors.Add("Employee Code could not be used as a login username (use letters, digits, . _ - only).");
                else if (usernamesTaken.Contains(usernameNorm))
                    errors.Add($"Login username '{usernameNorm}' (from Employee Code) is already in use");
                else if (!reservedSheetUsernames.Add(usernameNorm))
                    errors.Add($"Duplicate login username '{usernameNorm}' from Employee Code in this file");
            }

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, errors));
                continue;
            }

            var personalEmailCol = Cell(row, "Personal Email");
            var resolvedEmail = ResolveEmployeeWorkEmail(emailWork, personalEmailCol, empCode!);

            if (!string.IsNullOrEmpty(mgrCodeRaw) && mgrCodeRaw.Equals(empCode, StringComparison.OrdinalIgnoreCase))
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, new List<string> { "Manager Employee Code cannot be the same as this row's Employee Code" }));
                continue;
            }

            var buName = Cell(row, "Business Unit");
            var bu = buName != null ? businessUnits.FirstOrDefault(b => b.Name.Equals(buName, StringComparison.OrdinalIgnoreCase)) : null;
            var gradeName = Cell(row, "Grade");
            var grade = gradeName != null ? grades.FirstOrDefault(g => g.Name.Equals(gradeName, StringComparison.OrdinalIgnoreCase)) : null;
            var locName = Cell(row, "Location");
            var loc = locName != null ? locations.FirstOrDefault(l => l.Name.Equals(locName, StringComparison.OrdinalIgnoreCase)) : null;
            var jtName = Cell(row, "Job Title");
            var jt = jtName != null ? jobTitles.FirstOrDefault(j => j.Title.Equals(jtName, StringComparison.OrdinalIgnoreCase)) : null;

            var lifecycleStatus = defaultEmployeeStatusCode;
            var lifecycleRaw = Cell(row, "Employee Status");
            if (!string.IsNullOrEmpty(lifecycleRaw))
            {
                if (!employeeStatusCanonical.TryGetValue(lifecycleRaw.Trim(), out var canonSt))
                    errors.Add($"Invalid Employee Status '{lifecycleRaw}' (use Reference column D — codes from Administration → Organization, or legacy enum names)");
                else
                    lifecycleStatus = canonSt;
            }

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, errors));
                continue;
            }

            if (!string.IsNullOrEmpty(resolvedEmail))
            {
                if (emailsSeenInFile.Contains(resolvedEmail))
                {
                    skipped++;
                    results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false,
                        new List<string> { $"Duplicate email in this file: '{resolvedEmail}' appears on more than one row." }));
                    continue;
                }

                if (existingEmailSet.Contains(resolvedEmail))
                {
                    skipped++;
                    results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false,
                        new List<string> { $"Email '{resolvedEmail}' is already used (each employee must have a unique work email)." }));
                    continue;
                }

                emailsSeenInFile.Add(resolvedEmail);
            }

            var fingerprintIdRaw = Cell(row, "Fingerprint ID");
            var fingerprintId = string.IsNullOrWhiteSpace(fingerprintIdRaw) ? null : fingerprintIdRaw.Trim();
            if (fingerprintId != null)
            {
                if (fingerprintId.Length > MaxEmployeeCodeLength)
                    errors.Add($"Fingerprint ID must be at most {MaxEmployeeCodeLength} characters (this row has {fingerprintId.Length}).");
                else if (fingerprintsSeenInFile.Contains(fingerprintId))
                    errors.Add($"Duplicate Fingerprint ID in this file: '{fingerprintId}' appears on more than one row.");
                else if (existingFingerprintSet.Contains(fingerprintId))
                    errors.Add($"Fingerprint ID '{fingerprintId}' is already assigned to another employee.");
            }

            ValidateEmployeeImportFieldLengths(
                errors,
                empCode,
                Cell(row, "Phone"),
                Cell(row, "Home Telephone"),
                Cell(row, "Work Telephone"),
                Cell(row, "Zip/Postal Code"),
                Cell(row, "Permanent Zip/Postal Code"));

            InputValidators.ValidateEmployeeImportAddressFields(
                errors,
                Cell(row, "Address Street 1"),
                Cell(row, "Address Street 2"),
                Cell(row, "City"),
                Cell(row, "Zip/Postal Code"),
                Cell(row, "Polling Division"),
                Cell(row, "Distance to Office"),
                Cell(row, "Permanent Street 1"),
                Cell(row, "Permanent Street 2"),
                Cell(row, "Permanent City"),
                Cell(row, "Permanent Zip/Postal Code"),
                Cell(row, "Permanent Polling Division"),
                Cell(row, "Permanent Distance to Office"));

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new RowResult(r, firstName ?? "", lastName ?? "", false, errors));
                continue;
            }

            if (fingerprintId != null)
            {
                fingerprintsSeenInFile.Add(fingerprintId);
                existingFingerprintSet.Add(fingerprintId);
            }

            var employee = new Employee
            {
                EmployeeCode = empCode!,
                FirstName = firstName!,
                MiddleName = Cell(row, "Middle Name"),
                LastName = lastName!,
                Email = resolvedEmail,
                Phone = Cell(row, "Phone"),
                DateOfBirth = DateTime.SpecifyKind(dobStr!.Value, DateTimeKind.Utc),
                Gender = gender,
                JoinDate = DateTime.SpecifyKind(joinStr!.Value, DateTimeKind.Utc),
                Status = lifecycleStatus,
                EmploymentType = employmentType,
                DepartmentId = dept!.Id,
                BusinessUnitId = bu?.Id,
                GradeId = grade?.Id,
                LocationId = loc?.Id,
                JobTitleId = jt?.Id,
                PositionId = position?.Id,
                ManagerId = managerId,
                ShiftPatternId = shiftPattern?.Id,
                MaritalStatus = Cell(row, "Marital Status"),
                Nationality = Cell(row, "Nationality"),
                Religion = Cell(row, "Religion"),
                Ethnicity = Cell(row, "Ethnicity"),
                NationalId = Cell(row, "National ID"),
                OtherId = Cell(row, "Other ID"),
                FingerprintId = fingerprintId,
                TinNumber = Cell(row, "TIN Number"),
                EpfNumber = Cell(row, "EPF Number"),
                EtfNumber = Cell(row, "ETF Number"),
                DriversLicenseNumber = Cell(row, "Driver License Number"),
                DriversLicenseType = Cell(row, "Driver License Type"),
                LicenseIssueDate = DateCell(row, "License Issue Date") is DateTime lid ? DateTime.SpecifyKind(lid, DateTimeKind.Utc) : null,
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
                District = Cell(row, "District"),
                PollingDivision = Cell(row, "Polling Division"),
                DistanceToOffice = Cell(row, "Distance to Office"),
                ModeOfTransport = Cell(row, "Mode of Transport"),
                PermanentStreet1 = Cell(row, "Permanent Street 1"),
                PermanentStreet2 = Cell(row, "Permanent Street 2"),
                PermanentCity = Cell(row, "Permanent City"),
                PermanentCountry = Cell(row, "Permanent Country"),
                PermanentStateProvince = Cell(row, "Permanent State/Province"),
                PermanentZipPostalCode = Cell(row, "Permanent Zip/Postal Code"),
                PermanentDistrict = Cell(row, "Permanent District"),
                PermanentPollingDivision = Cell(row, "Permanent Polling Division"),
                PermanentDistanceToOffice = Cell(row, "Permanent Distance to Office"),
                ProbationEndDate = DateCell(row, "Probation End Date") is DateTime ped ? DateTime.SpecifyKind(ped, DateTimeKind.Utc) : null,
                DateOfPermanency = DateCell(row, "Date of Permanency") is DateTime dop ? DateTime.SpecifyKind(dop, DateTimeKind.Utc) : null,
                TerminationDate = DateCell(row, "Termination Date") is DateTime td ? DateTime.SpecifyKind(td, DateTimeKind.Utc) : null,
                TerminationReason = Cell(row, "Termination Reason"),
                TerminationNote = Cell(row, "Termination Note"),
                IsTopOfHierarchy = ParseYesNo(Cell(row, "Is Top of Hierarchy")),
            };

            _db.Employees.Add(employee);
            try
            {
                await _db.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                DetachTrackedEmployee(employee);
                skipped++;
                results.Add(new RowResult(r, firstName!, lastName!, false, DescribeEmployeeImportSaveFailure(ex)));
                continue;
            }

            existingCodesForGeneration.Add(empCode!);
            reservedEmployeeCodes.Add(empCode!);
            if (!string.IsNullOrEmpty(resolvedEmail))
                existingEmailSet.Add(resolvedEmail);
            if (!managerLookup.ContainsKey(empCode!))
                managerLookup[empCode!] = employee.Id;
            created++;
            var rowNotes = new List<string>();
            if (wantLogins && !empCodeFromSheet)
                rowNotes.Add("Employee created; login skipped (Employee Code blank).");
            results.Add(new RowResult(r, firstName!, lastName!, true, new List<string>(), rowNotes.Count > 0 ? rowNotes : null));
            if (wantLogins && empCodeFromSheet)
                loginJobs.Add((r, employee, empCode!));
        }

        var loginsCreated = 0;
        if (wantLogins && loginJobs.Count > 0)
        {
            var employeeRoleId = await _db.SecurityRoles.AsNoTracking()
                .Where(x => x.Code == "EMPLOYEE")
                .Select(x => x.Id)
                .FirstOrDefaultAsync();
            if (employeeRoleId != Guid.Empty)
            {
                var defaultPasswordHash = BCrypt.Net.BCrypt.HashPassword(BulkImportDefaultLoginPassword);
                foreach (var job in loginJobs)
                {
                    if (await _db.Users.AnyAsync(u => u.EmployeeId == job.Emp.Id && !u.IsDeleted))
                        continue;

                    string username;
                    try
                    {
                        username = AllocateUsernameFromImportSheet(usernamesTaken, job.EmployeeCodeForLogin);
                    }
                    catch (InvalidOperationException)
                    {
                        ReplaceRowNotes(results, job.Row, new List<string> { "Login not created: could not allocate a unique username." });
                        continue;
                    }

                    var user = new User
                    {
                        Username = username,
                        Email = job.Emp.Email,
                        PasswordHash = defaultPasswordHash,
                        MustChangePassword = true,
                        IsActive = true,
                        EmployeeId = job.Emp.Id,
                    };
                    user.UserRoles.Add(new UserRole { RoleId = employeeRoleId });
                    _db.Users.Add(user);
                    try
                    {
                        await _db.SaveChangesAsync();
                        loginsCreated++;
                        ReplaceRowNotes(results, job.Row, new List<string> { $"User login created (username: {username})." });
                    }
                    catch (DbUpdateException)
                    {
                        DetachTrackedUser(user);
                        ReplaceRowNotes(results, job.Row, new List<string> { "Login not created: could not save user (duplicate username or email)." });
                    }
                }
            }
        }

        return Ok(new UploadResult(created, skipped, lastRow - 1, loginsCreated, results));
        } // using (wb)
    }

    private static void ReplaceRowNotes(List<RowResult> results, int row, List<string> notes)
    {
        for (var i = 0; i < results.Count; i++)
        {
            if (results[i].Row != row || !results[i].Success) continue;
            results[i] = results[i] with { Notes = notes };
            return;
        }
    }

    private static IXLWorksheet GetEmployeeImportWorksheet(XLWorkbook wb)
    {
        foreach (var sheet in wb.Worksheets)
        {
            if (string.Equals(sheet.Name, "Employees", StringComparison.OrdinalIgnoreCase))
                return sheet;
        }

        return wb.Worksheet(1);
    }

    /// <summary>Trim BOM/zero-width/NBSP and collapse whitespace so template headers still match after Excel edits.</summary>
    private static string NormalizeImportHeaderKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        var s = raw.Trim();
        s = s.Replace("\uFEFF", "", StringComparison.Ordinal);
        s = s.Replace("\u00A0", " ", StringComparison.Ordinal);
        s = s.Replace("\u200B", "", StringComparison.Ordinal);
        s = s.Replace("\u200C", "", StringComparison.Ordinal);
        s = s.Replace("\u200D", "", StringComparison.Ordinal);
        s = Regex.Replace(s, @"\s+", " ", RegexOptions.CultureInvariant).Trim();
        return s;
    }

    /// <summary>Reads display text from a cell (text, number, boolean) so import values are not missed when Excel stores them as a number.</summary>
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
                return cell.GetDateTime().ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            default:
            {
                var s = cell.GetFormattedString().Trim();
                if (!string.IsNullOrEmpty(s)) return s;
                s = cell.GetString().Trim();
                return string.IsNullOrEmpty(s) ? null : s;
            }
        }
    }

    private static string? ResolveEmployeeWorkEmail(string? workEmail, string? personalEmail, string employeeCode)
    {
        var work = NormalizeImportEmail(workEmail);
        if (work != null) return work;
        return NormalizeImportEmail(personalEmail);
    }

    /// <summary>Treat Excel placeholders and non-email text as empty so import does not store "-" or "#N/A" as work email.</summary>
    private static string? NormalizeImportEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var s = value.Trim();
        if (s.Equals("-", StringComparison.Ordinal)
            || s.Equals("0", StringComparison.Ordinal)
            || s.Equals("#N/A", StringComparison.OrdinalIgnoreCase)
            || s.Equals("N/A", StringComparison.OrdinalIgnoreCase)
            || s.Equals("NA", StringComparison.OrdinalIgnoreCase)
            || s.Equals("n/a", StringComparison.Ordinal))
            return null;
        if (s.IndexOf('@') < 1 || s.IndexOf('.') <= s.IndexOf('@'))
            return null;
        if (!InputValidators.IsValidEmailInput(s))
            return null;
        return s;
    }

    private void DetachTrackedEmployee(Employee employee)
    {
        var entry = _db.Entry(employee);
        if (entry.State != EntityState.Detached)
            entry.State = EntityState.Detached;
    }

    private void DetachTrackedUser(User user)
    {
        var entry = _db.Entry(user);
        if (entry.State != EntityState.Detached)
            entry.State = EntityState.Detached;
    }

    private static List<string> DescribeEmployeeImportSaveFailure(DbUpdateException ex)
    {
        for (var inner = ex.InnerException; inner != null; inner = inner.InnerException)
        {
            if (inner is not PostgresException pg) continue;

            if (pg.SqlState == "22001")
            {
                return
                [
                    "One or more values exceed the maximum allowed length (Employee Code max 50, Phone max 100, Zip max 40).",
                ];
            }

            if (pg.SqlState == "23505")
            {
                var detail = pg.MessageText ?? pg.Message ?? "";
                if (detail.Contains("IX_Employees_EmployeeCode", StringComparison.OrdinalIgnoreCase)
                    || (detail.Contains("EmployeeCode", StringComparison.OrdinalIgnoreCase)
                        && detail.Contains("unique", StringComparison.OrdinalIgnoreCase)))
                {
                    return ["Employee Code already exists (including terminated or removed employees)."];
                }

                if (detail.Contains("IX_Employees_Email", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("email", StringComparison.OrdinalIgnoreCase))
                {
                    return ["Email is already used by another employee (including archived records)."];
                }

                if (detail.Contains("IX_Employees_FingerprintId", StringComparison.OrdinalIgnoreCase)
                    || detail.Contains("FingerprintId", StringComparison.OrdinalIgnoreCase))
                {
                    return ["Fingerprint ID is already assigned to another employee."];
                }

                return ["Duplicate value conflicts with existing data."];
            }
        }

        return ["Could not save employee. Check data and try again."];
    }

    private static string NormalizeUsernameCandidate(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return "";
        return SanitizeUsernameSegment(raw.Trim());
    }

    private static string SanitizeUsernameSegment(string value, int maxLen = 64)
    {
        var chars = value.Where(c => char.IsLetterOrDigit(c) || c is '.' or '_' or '-').Take(maxLen).ToArray();
        return new string(chars);
    }

    /// <summary>Reserves a unique login username from the employee code. Mutates <paramref name="taken"/>.</summary>
    private static string AllocateUsernameFromImportSheet(HashSet<string> taken, string? employeeCode)
    {
        string? TryOnce(string candidate)
        {
            var baseName = SanitizeUsernameSegment(candidate);
            if (string.IsNullOrEmpty(baseName)) return null;
            if (baseName.Length > 64) baseName = baseName[..64];
            var name = baseName;
            var n = 2;
            while (taken.Contains(name))
            {
                var suffix = $"-{n++}";
                var max = Math.Max(1, 64 - suffix.Length);
                name = (baseName.Length > max ? baseName[..max] : baseName) + suffix;
                if (n > 10_000) return null;
            }

            taken.Add(name);
            return name;
        }

        var fromSheetNorm = NormalizeUsernameCandidate(employeeCode);
        if (string.IsNullOrEmpty(fromSheetNorm))
            throw new InvalidOperationException("Employee Code could not be used as login username.");

        var u = TryOnce(fromSheetNorm);
        if (u != null) return u;

        throw new InvalidOperationException("Could not allocate username.");
    }

    private static async Task<Dictionary<string, string>> BuildEmploymentTypeCodeMapAsync(AppDbContext db)
    {
        var codes = await db.EmploymentStatusTypes.AsNoTracking()
            .Where(t => !t.IsDeleted)
            .Select(t => t.Code)
            .ToListAsync();
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in codes)
        {
            if (!string.IsNullOrWhiteSpace(c))
                map[c] = c;
        }

        foreach (var n in Enum.GetNames<EmploymentType>())
        {
            if (!map.ContainsKey(n))
                map[n] = n;
        }

        return map;
    }

    private static async Task<Dictionary<string, string>> BuildEmployeeStatusCodeMapAsync(AppDbContext db)
    {
        var codes = await db.EmployeeStatusTypes.AsNoTracking()
            .Where(t => !t.IsDeleted)
            .Select(t => t.Code)
            .ToListAsync();
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var c in codes)
        {
            if (!string.IsNullOrWhiteSpace(c))
                map[c] = c;
        }

        foreach (var n in Enum.GetNames<EmployeeStatus>())
        {
            if (!map.ContainsKey(n))
                map[n] = n;
        }

        return map;
    }

    private async Task<(string Prefix, int NumericLength)> ReadEmployeeCodeGenerationSettingsAsync()
    {
        var prefix = "EMP";
        var length = 6;
        var settingPrefix = await _db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == "EmployeeCodePrefix");
        var settingLength = await _db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == "EmployeeCodeLength");
        if (settingPrefix != null) prefix = settingPrefix.Value.Trim();
        if (settingLength != null && int.TryParse(settingLength.Value, out var l)) length = l;
        return (prefix, length);
    }

    /// <summary>Allocates the next unused employee code; checks all DB rows (including soft-deleted) via <paramref name="reservedCodes"/>.</summary>
    private static string GenerateNextEmployeeCode(
        List<string> existingCodes,
        HashSet<string> reservedCodes,
        string prefix,
        int length)
    {
        prefix = prefix.Trim();
        var usesSeparator = prefix.Length > 0;
        var separator = usesSeparator ? "-" : "";
        var maxPrefixLen = Math.Max(0, MaxEmployeeCodeLength - separator.Length - 1);
        if (prefix.Length > maxPrefixLen)
            prefix = prefix[..maxPrefixLen];

        var maxNumericDigits = Math.Max(1, MaxEmployeeCodeLength - prefix.Length - separator.Length);
        if (length > maxNumericDigits)
            length = maxNumericDigits;

        int max = 0;
        foreach (var code in existingCodes)
        {
            var numPart = code.Contains('-') ? code[(code.LastIndexOf('-') + 1)..] : code;
            if (int.TryParse(numPart, out var n) && n > max) max = n;
        }

        var nextNum = max + 1;
        while (true)
        {
            var padLength = length;
            while (padLength >= 1)
            {
                var next = nextNum.ToString().PadLeft(padLength, '0');
                var candidate = $"{prefix}{separator}{next}";
                if (candidate.Length <= MaxEmployeeCodeLength && !reservedCodes.Contains(candidate))
                    return candidate;
                padLength--;
            }

            var fallback = nextNum.ToString();
            var trimmed = fallback.Length <= MaxEmployeeCodeLength
                ? fallback
                : fallback[..MaxEmployeeCodeLength];
            if (!reservedCodes.Contains(trimmed))
                return trimmed;

            nextNum++;
        }
    }

    private IActionResult MapEmployeeImportDbUpdateException(DbUpdateException ex)
    {
        var rowErrors = DescribeEmployeeImportSaveFailure(ex);
        var message = rowErrors.Count > 0
            ? $"Import failed: {rowErrors[0]}"
            : "Import failed while saving employees. Check your data and try again.";
        return StatusCode(500, new
        {
            message,
            detail = ex.InnerException?.Message ?? ex.Message,
        });
    }

    private static void ValidateEmployeeImportFieldLengths(
        List<string> errors,
        string? employeeCode,
        string? phone,
        string? homeTelephone,
        string? workTelephone,
        string? zipPostalCode,
        string? permanentZipPostalCode)
    {
        AddMaxLengthError(errors, employeeCode, MaxEmployeeCodeLength, "Employee Code");
        AddMaxLengthError(errors, phone, MaxEmployeePhoneLength, "Phone");
        AddMaxLengthError(errors, homeTelephone, MaxEmployeePhoneLength, "Home Telephone");
        AddMaxLengthError(errors, workTelephone, MaxEmployeePhoneLength, "Work Telephone");
        AddMaxLengthError(errors, zipPostalCode, MaxEmployeeZipLength, "Zip/Postal Code");
        AddMaxLengthError(errors, permanentZipPostalCode, MaxEmployeeZipLength, "Permanent Zip/Postal Code");
    }

    private static void AddMaxLengthError(List<string> errors, string? value, int maxLength, string fieldLabel)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength) return;
        errors.Add($"{fieldLabel} must be at most {maxLength} characters (this row has {value.Length}).");
    }

    private static bool ParseYesNo(string? v)
    {
        if (string.IsNullOrWhiteSpace(v)) return false;
        v = v.Trim();
        return v.Equals("yes", StringComparison.OrdinalIgnoreCase)
            || v.Equals("y", StringComparison.OrdinalIgnoreCase)
            || v.Equals("true", StringComparison.OrdinalIgnoreCase)
            || v == "1";
    }

    /// <summary>Column headers for the employee import sheet. Order is for template UX only; upload matches by header name.</summary>
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
        "Employment Type",
        "Employee Status",
        "Department",
        "Business Unit",
        "Grade",
        "Job Title",
        "Location",
        "Position Code",
        "Manager Employee Code",
        "Shift Pattern Code",
        "Address Street 1",
        "Address Street 2",
        "City",
        "District",
        "Country",
        "State/Province",
        "Zip/Postal Code",
        "Polling Division",
        "Distance to Office",
        "Mode of Transport",
        "Permanent Street 1",
        "Permanent Street 2",
        "Permanent City",
        "Permanent District",
        "Permanent Country",
        "Permanent State/Province",
        "Permanent Zip/Postal Code",
        "Permanent Polling Division",
        "Permanent Distance to Office",
        "Marital Status",
        "Nationality",
        "Religion",
        "Ethnicity",
        "National ID",
        "Other ID",
        "Fingerprint ID",
        "TIN Number",
        "EPF Number",
        "ETF Number",
        "Driver License Number",
        "Driver License Type",
        "License Issue Date",
        "License Expiry Date",
        "License Issuing Country",
        "Home Telephone",
        "Work Telephone",
        "Personal Email",
        "Probation End Date",
        "Date of Permanency",
        "Termination Date",
        "Termination Reason",
        "Termination Note",
        "Is Top of Hierarchy",
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
        var cols = new[] { "Employee Code", "Leave Type", "Year", "Entitled", "Used", "Carried Forward", "Start Date", "End Date", "Reason" };
        for (int i = 0; i < cols.Length; i++)
        {
            ws.Cell(1, i + 1).Value = cols[i];
            ws.Cell(1, i + 1).Style.Font.Bold = true;
            ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.FromHtml("#7c3aed");
            ws.Cell(1, i + 1).Style.Font.FontColor = XLColor.White;
        }
        ws.Columns().AdjustToContents(1, 1);

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
        var existingLeaveRequests = await _db.LeaveRequests
            .Where(r => !r.IsDeleted &&
                (r.Status == ApprovalStatus.Pending || r.Status == ApprovalStatus.PendingLevel2 || r.Status == ApprovalStatus.Approved))
            .ToListAsync();

        var results = new List<LeaveBalanceRowResult>();
        int created = 0, updated = 0, skipped = 0;

        using var stream = file.OpenReadStream();
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheets.FirstOrDefault(s =>
                string.Equals(s.Name, "LeaveBalances", StringComparison.OrdinalIgnoreCase))
            ?? wb.Worksheets.FirstOrDefault(s =>
            {
                var headers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                for (int c = 1; c <= (s.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
                {
                    var h = NormalizeImportHeaderKey(GetCellTrimmedDisplayText(s.Cell(1, c)));
                    if (!string.IsNullOrEmpty(h)) headers.Add(h);
                }
                return headers.Contains("Employee Code") && headers.Contains("Leave Type") && headers.Contains("Year");
            });
        if (ws is null)
            return BadRequest("Could not find a LeaveBalances sheet. Fill the LeaveBalances sheet (not Employees or LeaveTypes) and upload again.");

        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int c = 1; c <= (ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++)
        {
            var key = NormalizeImportHeaderKey(GetCellTrimmedDisplayText(ws.Cell(1, c)));
            if (!string.IsNullOrEmpty(key))
                headerMap[key] = c;
        }

        string? Cell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return null;
            return GetCellTrimmedDisplayText(row.Cell(c));
        }

        decimal? DecCell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return null;
            var cell = row.Cell(c);
            if (cell.DataType == XLDataType.Number) return (decimal)cell.GetDouble();
            var s = GetCellTrimmedDisplayText(cell);
            if (s != null && decimal.TryParse(s, NumberStyles.Number, CultureInfo.InvariantCulture, out var d)) return d;
            if (s != null && decimal.TryParse(s, NumberStyles.Number, CultureInfo.CurrentCulture, out d)) return d;
            return null;
        }

        DateTime? DateCell(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return null;
            var cell = row.Cell(c);
            if (cell.DataType == XLDataType.DateTime) return cell.GetDateTime().Date;
            if (cell.DataType == XLDataType.Number && cell.TryGetValue<double>(out var oaDate))
            {
                try
                {
                    if (oaDate >= 1 && oaDate < 2958466)
                        return DateTime.FromOADate(oaDate).Date;
                }
                catch (ArgumentException)
                {
                    /* fall through to text parse */
                }
            }

            var s = GetCellTrimmedDisplayText(cell);
            if (string.IsNullOrEmpty(s)) return null;
            if (DateTime.TryParse(s, CultureInfo.CurrentCulture, DateTimeStyles.None, out var dt)) return dt.Date;
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt)) return dt.Date;
            return null;
        }

        bool HasDateColumnValue(IXLRow row, string colName)
        {
            if (!headerMap.TryGetValue(NormalizeImportHeaderKey(colName), out int c)) return false;
            var cell = row.Cell(c);
            return cell.DataType != XLDataType.Blank && !string.IsNullOrWhiteSpace(GetCellTrimmedDisplayText(cell));
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int r = 2; r <= lastRow; r++)
        {
            var row = ws.Row(r);
            var errors = new List<string>();
            var notes = new List<string>();

            var empCode = Cell(row, "Employee Code");
            var leaveTypeName = Cell(row, "Leave Type");
            var yearStr = Cell(row, "Year");
            var entitled = DecCell(row, "Entitled");
            var used = DecCell(row, "Used");
            var carried = DecCell(row, "Carried Forward");
            var reason = Cell(row, "Reason");

            var startRaw = HasDateColumnValue(row, "Start Date");
            var endRaw = HasDateColumnValue(row, "End Date");
            var startDate = DateCell(row, "Start Date");
            var endDate = DateCell(row, "End Date");

            if (string.IsNullOrEmpty(empCode)) errors.Add("Employee Code is required");
            if (string.IsNullOrEmpty(leaveTypeName)) errors.Add("Leave Type is required");
            if (string.IsNullOrEmpty(yearStr) || !int.TryParse(yearStr, out var year)) { errors.Add("Valid Year is required"); year = 0; }
            if (entitled is null) errors.Add("Entitled is required");

            if (startRaw || endRaw)
            {
                if (startDate is null) errors.Add("Start Date is invalid or missing");
                if (endDate is null) errors.Add("End Date is invalid or missing");
                if (startDate is not null && endDate is not null && endDate < startDate)
                    errors.Add("End Date cannot be before Start Date");
            }

            var emp = employees.FirstOrDefault(e => e.EmployeeCode.Equals(empCode, StringComparison.OrdinalIgnoreCase));
            if (emp is null && !string.IsNullOrEmpty(empCode)) errors.Add($"Employee '{empCode}' not found");

            var lt = leaveTypes.FirstOrDefault(t => t.Name.Equals(leaveTypeName, StringComparison.OrdinalIgnoreCase));
            if (lt is null && !string.IsNullOrEmpty(leaveTypeName)) errors.Add($"Leave Type '{leaveTypeName}' not found");

            if (errors.Count > 0)
            {
                skipped++;
                results.Add(new LeaveBalanceRowResult(r, empCode ?? "", leaveTypeName ?? "", "Skipped", errors, notes));
                continue;
            }

            var existing = existingBalances.FirstOrDefault(b =>
                b.EmployeeId == emp!.Id && b.LeaveTypeId == lt!.Id && b.Year == year);

            string status;
            if (existing != null)
            {
                existing.Entitled = entitled!.Value;
                existing.Used = used ?? 0;
                existing.CarriedForward = carried ?? 0;
                existing.BroughtForwardDays = Math.Max(existing.BroughtForwardDays, carried ?? 0);
                updated++;
                status = "Updated";
            }
            else
            {
                var cf = carried ?? 0;
                var balance = new LeaveBalance
                {
                    EmployeeId = emp!.Id,
                    LeaveTypeId = lt!.Id,
                    Year = year,
                    Entitled = entitled!.Value,
                    Used = used ?? 0,
                    CarriedForward = cf,
                    BroughtForwardDays = cf,
                };
                _db.LeaveBalances.Add(balance);
                existingBalances.Add(balance);
                created++;
                status = "Created";
            }

            if (startDate is not null && endDate is not null)
            {
                var start = DateTime.SpecifyKind(startDate.Value.Date, DateTimeKind.Utc);
                var end = DateTime.SpecifyKind(endDate.Value.Date, DateTimeKind.Utc);
                var totalDays = (decimal)((end.Date - start.Date).TotalDays + 1);

                var exactMatch = existingLeaveRequests.FirstOrDefault(lr =>
                    lr.EmployeeId == emp!.Id &&
                    lr.LeaveTypeId == lt!.Id &&
                    lr.StartDate.Date == start.Date &&
                    lr.EndDate.Date == end.Date);

                if (exactMatch != null)
                {
                    exactMatch.TotalDays = totalDays;
                    if (!string.IsNullOrWhiteSpace(reason))
                        exactMatch.Reason = reason.Trim();
                    if (exactMatch.Status != ApprovalStatus.Approved)
                    {
                        exactMatch.Status = ApprovalStatus.Approved;
                        exactMatch.ApprovedAt ??= DateTime.UtcNow;
                    }
                    notes.Add($"Leave dates updated ({start:yyyy-MM-dd} to {end:yyyy-MM-dd})");
                }
                else
                {
                    var overlaps = existingLeaveRequests.Any(lr =>
                        lr.EmployeeId == emp!.Id &&
                        lr.StartDate.Date <= end.Date &&
                        lr.EndDate.Date >= start.Date);
                    if (overlaps)
                    {
                        notes.Add($"Leave dates skipped — overlaps existing leave ({start:yyyy-MM-dd} to {end:yyyy-MM-dd})");
                    }
                    else
                    {
                        var leaveRequest = new LeaveRequest
                        {
                            EmployeeId = emp!.Id,
                            LeaveTypeId = lt!.Id,
                            StartDate = start,
                            EndDate = end,
                            TotalDays = totalDays,
                            Reason = string.IsNullOrWhiteSpace(reason) ? "Imported with leave balance" : reason.Trim(),
                            Status = ApprovalStatus.Approved,
                            ApprovedAt = DateTime.UtcNow,
                        };
                        _db.LeaveRequests.Add(leaveRequest);
                        existingLeaveRequests.Add(leaveRequest);
                        notes.Add($"Leave dates added ({start:yyyy-MM-dd} to {end:yyyy-MM-dd}, {totalDays:0.#} day(s))");
                    }
                }
            }

            results.Add(new LeaveBalanceRowResult(r, empCode!, leaveTypeName!, status, errors, notes));
        }

        await _db.SaveChangesAsync();

        return Ok(new LeaveBalanceUploadResult(created, updated, skipped, lastRow - 1, results));
    }

    public record RowResult(int Row, string FirstName, string LastName, bool Success, List<string> Errors, List<string>? Notes = null);
    public record UploadResult(int Created, int Skipped, int TotalRows, int LoginsCreated, List<RowResult> Results);
    public record LeaveBalanceRowResult(int Row, string EmployeeCode, string LeaveType, string Status, List<string> Errors, List<string>? Notes = null);
    public record LeaveBalanceUploadResult(int Created, int Updated, int Skipped, int TotalRows, List<LeaveBalanceRowResult> Results);
}
