using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Api.Filters;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Api.Controllers;

[Authorize]
[ApiController]
[RequireLicensedModule("Administration")]
[Route("api/[controller]")]
public class BulkUploadController : ControllerBase
{
    /// <summary>Default password for users created via bulk import when <c>Create employee logins</c> is enabled (must match Administration UI).</summary>
    public const string BulkImportDefaultLoginPassword = "123";

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

        var usernameColIndex = Array.FindIndex(cols, static c => string.Equals(c, "Username", StringComparison.OrdinalIgnoreCase));
        if (usernameColIndex >= 0)
        {
            var uc = ws.Cell(1, usernameColIndex + 1);
            uc.CreateComment();
            uc.GetComment().AddText(
                "Optional: used as sign-in username when \"Create employee logins\" is enabled. Must be unique in the system. Leave blank to auto-generate from email or name.");
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
        if (file is null || file.Length == 0)
            return BadRequest("No file uploaded.");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
            return BadRequest("Only .xlsx or .xls files are supported.");

        var wantLogins = string.Equals(createUserLogins, "true", StringComparison.OrdinalIgnoreCase);
        var loginJobs = new List<(int Row, Employee Emp, string? UsernameFromSheet)>();
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

        var existingEmployees = await _db.Employees.Where(e => !e.IsDeleted).Select(e => new { e.Id, e.EmployeeCode }).ToListAsync();
        var existingCodes = existingEmployees.Select(e => e.EmployeeCode).ToList();
        // Unique index IX_Employees_Email applies to all rows (including soft-deleted); match that when validating.
        var existingEmails = await _db.Employees.AsNoTracking().IgnoreQueryFilters()
            .Where(e => e.Email != null && e.Email != "")
            .Select(e => e.Email!)
            .ToListAsync();
        var existingEmailSet = new HashSet<string>(existingEmails.Select(e => e.Trim()), StringComparer.OrdinalIgnoreCase);
        var emailsSeenInFile = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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
            var emailWork = Cell(row, "Email");
            var usernameFromSheet = CellAny(row, "Username", "User name");
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

            var empCode = Cell(row, "Employee Code");
            if (!string.IsNullOrEmpty(empCode) && existingCodes.Contains(empCode))
                errors.Add($"Employee Code '{empCode}' already exists");

            var usernameNorm = NormalizeUsernameCandidate(usernameFromSheet);
            if (!string.IsNullOrEmpty(usernameNorm) && usernamesTaken.Contains(usernameNorm))
                errors.Add($"Username '{usernameNorm}' is already in use");
            if (!string.IsNullOrEmpty(usernameNorm) && !reservedSheetUsernames.Add(usernameNorm))
                errors.Add($"Duplicate Username '{usernameNorm}' in this file");

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
                empCode = await GenerateNextCode(existingCodes);

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
            existingCodes.Add(empCode!);
            existingEmailSet.Add(resolvedEmail);
            if (!managerLookup.ContainsKey(empCode!))
                managerLookup[empCode!] = employee.Id;
            created++;
            results.Add(new RowResult(r, firstName!, lastName!, true, new List<string>()));
            if (wantLogins)
                loginJobs.Add((r, employee, usernameFromSheet));
        }

        await _db.SaveChangesAsync();

        var loginsCreated = 0;
        if (wantLogins && loginJobs.Count > 0)
        {
            var employeeRoleId = await _db.SecurityRoles.AsNoTracking()
                .Where(x => x.Code == "EMPLOYEE")
                .Select(x => x.Id)
                .FirstOrDefaultAsync();
            if (employeeRoleId != Guid.Empty)
            {
                foreach (var job in loginJobs)
                {
                    if (await _db.Users.AnyAsync(u => u.EmployeeId == job.Emp.Id && !u.IsDeleted))
                        continue;

                    string username;
                    try
                    {
                        username = AllocateUsername(usernamesTaken, job.UsernameFromSheet, job.Emp.EmployeeCode, job.Emp.FirstName, job.Emp.LastName, job.Emp.Email);
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
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(BulkImportDefaultLoginPassword),
                        MustChangePassword = true,
                        IsActive = true,
                        EmployeeId = job.Emp.Id,
                    };
                    user.UserRoles.Add(new UserRole { RoleId = employeeRoleId });
                    _db.Users.Add(user);
                    loginsCreated++;
                    ReplaceRowNotes(results, job.Row, new List<string> { $"User login created (username: {username})." });
                }

                await _db.SaveChangesAsync();
            }
        }

        return Ok(new UploadResult(created, skipped, lastRow - 1, loginsCreated, results));
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

    private static string ResolveEmployeeWorkEmail(string? workEmail, string? personalEmail, string employeeCode)
    {
        if (!string.IsNullOrWhiteSpace(workEmail)) return workEmail.Trim();
        if (!string.IsNullOrWhiteSpace(personalEmail)) return personalEmail.Trim();
        var local = SanitizeUsernameSegment(employeeCode);
        if (string.IsNullOrEmpty(local)) local = "employee";
        return $"{local}@import.openskyhrm.local";
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

    /// <summary>Reserves a unique username; mutates <paramref name="taken"/>.</summary>
    private static string AllocateUsername(HashSet<string> taken, string? fromSheet, string empCode, string firstName, string lastName, string email)
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

        var fromSheetNorm = NormalizeUsernameCandidate(fromSheet);
        if (!string.IsNullOrEmpty(fromSheetNorm))
        {
            var u = TryOnce(fromSheetNorm);
            if (u != null) return u;
        }

        var at = email.IndexOf('@');
        if (at > 0)
        {
            var u = TryOnce(email[..at]);
            if (u != null) return u;
        }

        var fn = SanitizeUsernameSegment(firstName, 32);
        var ln = SanitizeUsernameSegment(lastName, 32);
        var combined = string.IsNullOrEmpty(fn) ? ln : string.IsNullOrEmpty(ln) ? fn : $"{fn}.{ln}";
        var u2 = TryOnce(combined);
        if (u2 != null) return u2;

        var u3 = TryOnce(SanitizeUsernameSegment(empCode));
        if (u3 != null) return u3;

        var u4 = TryOnce("user-" + Guid.NewGuid().ToString("n")[..10]);
        if (u4 != null) return u4;

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
        "Username",
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
                existing.BroughtForwardDays = Math.Max(existing.BroughtForwardDays, carried ?? 0);
                updated++;
                results.Add(new LeaveBalanceRowResult(r, empCode!, leaveTypeName!, "Updated", new List<string>()));
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
                results.Add(new LeaveBalanceRowResult(r, empCode!, leaveTypeName!, "Created", new List<string>()));
            }
        }

        await _db.SaveChangesAsync();

        return Ok(new LeaveBalanceUploadResult(created, updated, skipped, lastRow - 1, results));
    }

    public record RowResult(int Row, string FirstName, string LastName, bool Success, List<string> Errors, List<string>? Notes = null);
    public record UploadResult(int Created, int Skipped, int TotalRows, int LoginsCreated, List<RowResult> Results);
    public record LeaveBalanceRowResult(int Row, string EmployeeCode, string LeaveType, string Status, List<string> Errors);
    public record LeaveBalanceUploadResult(int Created, int Updated, int Skipped, int TotalRows, List<LeaveBalanceRowResult> Results);
}
