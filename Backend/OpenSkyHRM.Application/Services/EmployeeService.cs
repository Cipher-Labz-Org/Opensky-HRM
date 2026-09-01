using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.Organization;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;
using OpenSkyHRM.Persistence.Auditing;

namespace OpenSkyHRM.Application.Services;

public class EmployeeService : IEmployeeService
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;
    private readonly ILeaveEntitlementService _entitlementService;
    private readonly IEmployeeLifecycleService _lifecycleService;

    public EmployeeService(
        AppDbContext db,
        ISystemSettingService settings,
        ILeaveEntitlementService entitlementService,
        IEmployeeLifecycleService lifecycleService)
    {
        _db = db;
        _settings = settings;
        _entitlementService = entitlementService;
        _lifecycleService = lifecycleService;
    }

    private static bool IsProfileSetupIncomplete(Employee e, bool hasDirectSupervisor) =>
        (!e.IsTopOfHierarchy && !hasDirectSupervisor)
        || !e.JobTitleId.HasValue
        || !e.LocationId.HasValue;

    private IQueryable<Employee> ApplyEmployeeListSort(IQueryable<Employee> query, string? sortBy, string? sortDir)
    {
        var key = (sortBy ?? "employeeCode").Trim().ToLowerInvariant();
        var asc = !string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);
        var sortByEmployeeCode = key is "employeecode" or "employeeid" or "code" or "id";

        // Strict employee-code order (length then value) so numeric IDs sort 2, 10, 100, 1001 correctly.
        if (sortByEmployeeCode)
            return OrderByEmployeeCode(query, asc);

        var candidateEmployeeIds = _db.Candidates
            .Where(c => c.EmployeeId != null)
            .Select(c => c.EmployeeId!.Value);

        // For other columns, keep incomplete recruitment profiles visible at the top.
        IOrderedQueryable<Employee> ordered = query.OrderByDescending(e =>
            candidateEmployeeIds.Contains(e.Id)
            && ((!e.IsTopOfHierarchy && !_db.EmployeeSupervisors.Any(s =>
                    !s.IsDeleted && s.ReportingMethod == "Direct" && s.EmployeeId == e.Id))
                || e.JobTitleId == null
                || e.LocationId == null));

        return key switch
        {
            "name" or "fullname" => asc
                ? ordered.ThenBy(e => e.LastName).ThenBy(e => e.FirstName).ThenBy(e => e.MiddleName)
                : ordered.ThenByDescending(e => e.LastName).ThenByDescending(e => e.FirstName).ThenByDescending(e => e.MiddleName),
            "jobtitle" => asc
                ? ordered.ThenBy(e => (e.JobTitle != null ? e.JobTitle.Title : null) ?? (e.Position != null ? e.Position.Title : null) ?? "")
                : ordered.ThenByDescending(e => (e.JobTitle != null ? e.JobTitle.Title : null) ?? (e.Position != null ? e.Position.Title : null) ?? ""),
            "status" => asc ? ordered.ThenBy(e => e.Status) : ordered.ThenByDescending(e => e.Status),
            "employmenttype" => asc ? ordered.ThenBy(e => e.EmploymentType) : ordered.ThenByDescending(e => e.EmploymentType),
            "department" => asc
                ? ordered.ThenBy(e => e.Department != null ? e.Department.Name : "")
                : ordered.ThenByDescending(e => e.Department != null ? e.Department.Name : ""),
            "location" => asc
                ? ordered.ThenBy(e => e.Location != null ? e.Location.Name : "")
                : ordered.ThenByDescending(e => e.Location != null ? e.Location.Name : ""),
            "supervisor" or "manager" => asc
                ? ordered.ThenBy(e => e.Manager != null ? e.Manager.LastName : "").ThenBy(e => e.Manager != null ? e.Manager.FirstName : "")
                : ordered.ThenByDescending(e => e.Manager != null ? e.Manager.LastName : "").ThenByDescending(e => e.Manager != null ? e.Manager.FirstName : ""),
            _ => OrderByEmployeeCode(query, asc),
        };
    }

    /// <summary>
    /// Matches each whitespace-separated token against name parts, code, and optionally email
    /// so queries like "Madhavan Gunasekaram" still hit employees who have a middle name.
    /// </summary>
    private static IQueryable<Employee> ApplyEmployeeTextSearch(IQueryable<Employee> query, string? search, bool includeEmail)
    {
        if (string.IsNullOrWhiteSpace(search))
            return query;

        var tokens = search.Trim().ToLower()
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (tokens.Length == 0)
            return query;

        foreach (var token in tokens)
        {
            var t = token;
            if (includeEmail)
            {
                query = query.Where(e =>
                    e.FirstName.ToLower().Contains(t) ||
                    e.LastName.ToLower().Contains(t) ||
                    (e.MiddleName != null && e.MiddleName.ToLower().Contains(t)) ||
                    e.EmployeeCode.ToLower().Contains(t) ||
                    (e.Email != null && e.Email.ToLower().Contains(t)) ||
                    (e.OtherEmail != null && e.OtherEmail.ToLower().Contains(t)));
            }
            else
            {
                query = query.Where(e =>
                    e.FirstName.ToLower().Contains(t) ||
                    e.LastName.ToLower().Contains(t) ||
                    (e.MiddleName != null && e.MiddleName.ToLower().Contains(t)) ||
                    e.EmployeeCode.ToLower().Contains(t));
            }
        }

        return query;
    }

    private static IOrderedQueryable<Employee> OrderByEmployeeCode(IQueryable<Employee> query, bool asc)
    {
        return asc
            ? query.OrderBy(e => e.EmployeeCode.Length).ThenBy(e => e.EmployeeCode)
            : query.OrderByDescending(e => e.EmployeeCode.Length).ThenByDescending(e => e.EmployeeCode);
    }

    private async Task<HashSet<Guid>> GetCandidateLinkedEmployeeIdsAsync(IEnumerable<Guid> employeeIds)
    {
        var ids = employeeIds.ToList();
        if (ids.Count == 0) return [];

        return (await _db.Candidates.AsNoTracking()
            .Where(c => c.EmployeeId != null && ids.Contains(c.EmployeeId.Value))
            .Select(c => c.EmployeeId!.Value)
            .ToListAsync())
            .ToHashSet();
    }

    private async Task<Dictionary<Guid, string>> GetAssignedSupervisorNamesMapAsync(IEnumerable<Guid> employeeIds)
    {
        var idList = employeeIds.ToList();
        if (idList.Count == 0)
            return new Dictionary<Guid, string>();

        var supervisors = await _db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Include(s => s.Supervisor)
            .Where(s => !s.IsDeleted && idList.Contains(s.EmployeeId))
            .OrderBy(s => s.Supervisor.LastName)
            .ThenBy(s => s.Supervisor.FirstName)
            .Select(s => new
            {
                s.EmployeeId,
                SupervisorName = s.Supervisor.FirstName,
            })
            .ToListAsync();

        return supervisors
            .GroupBy(s => s.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => string.Join(", ", g.Select(x => x.SupervisorName.Trim()).Where(n => n.Length > 0).Distinct()));
    }

    private async Task<HashSet<Guid>> GetEmployeesWithDirectSupervisorAsync(IEnumerable<Guid> employeeIds)
    {
        var idList = employeeIds.ToList();
        if (idList.Count == 0)
            return new HashSet<Guid>();

        var ids = await _db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Where(s => !s.IsDeleted && s.ReportingMethod == "Direct" && idList.Contains(s.EmployeeId))
            .Select(s => s.EmployeeId)
            .Distinct()
            .ToListAsync();

        return ids.ToHashSet();
    }

    public async Task<PagedResult<EmployeeDto>> GetAllAsync(
        int page = 1, int pageSize = 20, string? search = null,
        Guid? departmentId = null, Guid? jobTitleId = null,
        Guid? locationId = null, Guid? managerId = null, string? status = null,
        string? employmentType = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null, bool excludeTerminated = false,
        string? sortBy = null, string? sortDir = null)
    {
        var query = _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .AsQueryable();

        query = ApplyEmployeeTextSearch(query, search, includeEmail: true);

        if (departmentId.HasValue)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        if (jobTitleId.HasValue)
            query = query.Where(e => e.JobTitleId == jobTitleId.Value);

        if (locationId.HasValue)
            query = query.Where(e => e.LocationId == locationId.Value);

        if (managerId.HasValue)
            query = query.Where(e => e.ManagerId == managerId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(e => e.Status == status);

        if (!string.IsNullOrWhiteSpace(employmentType))
            query = query.Where(e => e.EmploymentType == employmentType);

        if (excludeTerminated && string.IsNullOrWhiteSpace(status))
            query = query.Where(e => e.Status != "Terminated");

        if (allowedEmployeeIds != null)
        {
            query = allowedEmployeeIds.Count == 0
                ? query.Where(_ => false)
                : query.Where(e => allowedEmployeeIds.Contains(e.Id));
        }

        query = ApplyEmployeeListSort(query, sortBy, sortDir);

        var totalCount = await query.CountAsync();

        var entities = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = entities.Select(e => MapToDto(e)).ToList();

        var empIds = items.Select(i => i.Id).ToList();
        var supMap = await GetAssignedSupervisorNamesMapAsync(empIds);
        var directSupIds = await GetEmployeesWithDirectSupervisorAsync(empIds);
        var candidateLinkedIds = await GetCandidateLinkedEmployeeIdsAsync(empIds);
        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            item.HasDirectSupervisor = directSupIds.Contains(item.Id);
            if (supMap.TryGetValue(item.Id, out var supName))
            {
                item.ManagerName = supName;
                item.SupervisorNames = supName;
            }
            item.NeedsProfileSetup = candidateLinkedIds.Contains(item.Id)
                && IsProfileSetupIncomplete(entities[i], item.HasDirectSupervisor);
        }

        return new PagedResult<EmployeeDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<PagedResult<EmployeeLookupDto>> GetLookupAsync(
        int pageSize = 50, string? search = null, Guid? departmentId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null, bool excludeTerminated = true)
    {
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.Employees.AsNoTracking().AsQueryable();

        query = ApplyEmployeeTextSearch(query, search, includeEmail: false);

        if (departmentId.HasValue)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        if (excludeTerminated)
            query = query.Where(e => e.Status != "Terminated");

        if (allowedEmployeeIds != null)
        {
            query = allowedEmployeeIds.Count == 0
                ? query.Where(_ => false)
                : query.Where(e => allowedEmployeeIds.Contains(e.Id));
        }

        var items = await query
            .OrderBy(e => e.FirstName)
            .ThenBy(e => e.LastName)
            .ThenBy(e => e.EmployeeCode)
            .Take(pageSize)
            .Select(e => new EmployeeLookupDto
            {
                Id = e.Id,
                EmployeeCode = e.EmployeeCode,
                FirstName = e.FirstName,
                LastName = e.LastName,
                FullName = e.MiddleName == null || e.MiddleName == ""
                    ? e.FirstName + " " + e.LastName
                    : e.FirstName + " " + e.MiddleName + " " + e.LastName,
                DepartmentName = e.Department != null ? e.Department.Name : null,
            })
            .ToListAsync();

        return new PagedResult<EmployeeLookupDto>
        {
            Items = items,
            TotalCount = items.Count,
            Page = 1,
            PageSize = pageSize,
        };
    }

    public async Task<EmployeeDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        if (allowedEmployeeIds != null)
        {
            if (allowedEmployeeIds.Count == 0)
                return null;
            if (!allowedEmployeeIds.Contains(id))
                return null;
        }

        var employee = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .Include(e => e.ShiftPattern)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee is null) return null;

        // Display-only: MapToDto uses ToDisplayEmail — do not persist null here.
        // Clearing placeholder on read fails on DBs where Email is still NOT NULL,
        // and would surface a false error after a successful create.
        var dto = MapToDto(employee);
        var supMap = await GetAssignedSupervisorNamesMapAsync(new[] { employee.Id });
        var directSupIds = await GetEmployeesWithDirectSupervisorAsync(new[] { employee.Id });
        dto.HasDirectSupervisor = directSupIds.Contains(employee.Id);
        if (supMap.TryGetValue(employee.Id, out var supName))
        {
            dto.ManagerName = supName;
            dto.SupervisorNames = supName;
        }
        var candidateLinkedIds = await GetCandidateLinkedEmployeeIdsAsync(new[] { employee.Id });
        dto.NeedsProfileSetup = candidateLinkedIds.Contains(employee.Id)
            && IsProfileSetupIncomplete(employee, dto.HasDirectSupervisor);
        return dto;
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto)
    {
        InputValidators.ValidatePersonName(dto.FirstName, "First name");
        InputValidators.ValidatePersonName(dto.MiddleName, "Middle name", required: false);
        InputValidators.ValidatePersonName(dto.LastName, "Last name");
        dto.Phone = InputValidators.NormalizePhone(dto.Phone);
        InputValidators.ValidatePhone(dto.Phone, "Mobile phone", required: false);
        InputValidators.ValidateEmployeeHireDates(dto.DateOfBirth, dto.JoinDate);
        InputValidators.ValidatePhone(dto.HomeTelephone, "Home telephone", required: false);
        InputValidators.ValidatePhone(dto.WorkTelephone, "Work telephone", required: false);
        InputValidators.ValidateNic(dto.NationalId, "NIC number", required: false);
        InputValidators.ValidateDrivingLicense(dto.DriversLicenseNumber, "Driving license number", required: false);
        InputValidators.ValidateTin(dto.TinNumber, "TIN number", required: false);
        InputValidators.ValidateEpfNumber(dto.EpfNumber, "EPF number", required: false);
        InputValidators.ValidateEtfNumber(dto.EtfNumber, "ETF number", required: false);
        InputValidators.ValidateEmailInput(dto.Email, "Work email", required: false);
        InputValidators.ValidateEmailInput(dto.OtherEmail, "Personal email", required: false);
        InputValidators.ValidateEmployeeAddressFields(
            dto.AddressStreet1,
            dto.AddressStreet2,
            dto.City,
            dto.ZipPostalCode,
            dto.PollingDivision,
            dto.DistanceToOffice,
            dto.PermanentStreet1,
            dto.PermanentStreet2,
            dto.PermanentCity,
            dto.PermanentZipPostalCode,
            dto.PermanentPollingDivision,
            dto.PermanentDistanceToOffice);
        dto.TinNumber = InputValidators.NormalizeTin(dto.TinNumber);
        dto.EpfNumber = InputValidators.NormalizeStatutoryFundNumber(dto.EpfNumber);
        dto.EtfNumber = InputValidators.NormalizeStatutoryFundNumber(dto.EtfNumber);

        if (dto.DepartmentId == Guid.Empty)
            throw new InvalidOperationException("Department is required.");

        var code = string.IsNullOrWhiteSpace(dto.EmployeeCode)
            ? await _settings.GenerateNextEmployeeCodeAsync()
            : dto.EmployeeCode.Trim();

        dto.DateOfBirth = ToWallDate(dto.DateOfBirth);
        dto.JoinDate = ToWallDate(dto.JoinDate);

        var resolvedEmail = EmployeeEmailHelper.ResolveForCreate(code, dto.Email);

        await EmployeeUniqueness.ValidateForCreateAsync(_db, code, resolvedEmail);
        var fingerprintId = EmployeeUniqueness.NormalizeFingerprintId(dto.FingerprintId);
        await EmployeeUniqueness.ValidateFingerprintIdAsync(_db, null, fingerprintId);

        var employee = new Employee
        {
            EmployeeCode = code,
            FirstName = dto.FirstName,
            MiddleName = dto.MiddleName,
            LastName = dto.LastName,
            Email = resolvedEmail,
            Phone = dto.Phone,
            DateOfBirth = dto.DateOfBirth,
            Gender = ParseGender(dto.Gender),
            MaritalStatus = dto.MaritalStatus,
            Nationality = dto.Nationality,
            Religion = dto.Religion,
            Ethnicity = dto.Ethnicity,
            OtherId = dto.OtherId,
            FingerprintId = fingerprintId,
            NationalId = dto.NationalId,
            TinNumber = dto.TinNumber,
            EpfNumber = dto.EpfNumber,
            EtfNumber = dto.EtfNumber,
            DriversLicenseNumber = dto.DriversLicenseNumber,
            DriversLicenseType = dto.DriversLicenseType,
            LicenseIssueDate = dto.LicenseIssueDate,
            LicenseExpiryDate = dto.LicenseExpiryDate,
            DriversLicenseIssuingCountry = dto.DriversLicenseIssuingCountry,
            AddressStreet1 = dto.AddressStreet1,
            AddressStreet2 = dto.AddressStreet2,
            City = dto.City,
            Country = dto.Country,
            StateProvince = dto.StateProvince,
            ZipPostalCode = dto.ZipPostalCode,
            District = dto.District,
            PollingDivision = dto.PollingDivision,
            DistanceToOffice = dto.DistanceToOffice,
            ModeOfTransport = dto.ModeOfTransport,
            HomeTelephone = dto.HomeTelephone,
            WorkTelephone = dto.WorkTelephone,
            OtherEmail = dto.OtherEmail,
            PermanentStreet1 = dto.PermanentStreet1,
            PermanentStreet2 = dto.PermanentStreet2,
            PermanentCity = dto.PermanentCity,
            PermanentCountry = dto.PermanentCountry,
            PermanentStateProvince = dto.PermanentStateProvince,
            PermanentZipPostalCode = dto.PermanentZipPostalCode,
            PermanentDistrict = dto.PermanentDistrict,
            PermanentPollingDivision = dto.PermanentPollingDivision,
            PermanentDistanceToOffice = dto.PermanentDistanceToOffice,
            JoinDate = dto.JoinDate,
            ProbationEndDate = dto.ProbationEndDate,
            DateOfPermanency = dto.DateOfPermanency,
            Status = "Active",
            EmploymentType = "FullTimePermanent",
            DepartmentId = dto.DepartmentId,
            BusinessUnitId = dto.BusinessUnitId,
            PositionId = dto.PositionId,
            LocationId = dto.LocationId,
            GradeId = dto.GradeId,
            JobTitleId = dto.JobTitleId,
            ManagerId = dto.ManagerId,
        };

        _db.Employees.Add(employee);
        await _db.SaveChangesAsync();

        if (fingerprintId != null)
            await ResetBiometricPunchesForFingerprintIdAsync(fingerprintId);

        try
        {
            await _lifecycleService.RecordJoinedAsync(employee);
        }
        catch
        {
            // Employee record is saved; lifecycle timeline can be backfilled later.
        }

        try
        {
            var calendarYear = DateTime.UtcNow.Year;
            await _entitlementService.CalculateAndApplyAsync(employee.Id, calendarYear);
            if (employee.JoinDate.Year != calendarYear)
                await _entitlementService.CalculateAndApplyAsync(employee.Id, employee.JoinDate.Year);
        }
        catch
        {
            // Leave balances can be recalculated from Leave admin; do not roll back the hire.
        }

        return (await GetByIdAsync(employee.Id))!;
    }

    public async Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return null;

        // Do not clear placeholder emails here. Job/Personal tabs send displayWorkEmail("") for
        // placeholders; persisting null fails on databases where Employees.Email is still NOT NULL.

        if (!InputValidators.ValuesEqual(dto.FirstName, employee.FirstName))
            InputValidators.ValidatePersonName(dto.FirstName, "First name");
        if (!InputValidators.ValuesEqual(dto.MiddleName, employee.MiddleName))
            InputValidators.ValidatePersonName(dto.MiddleName, "Middle name", required: false);
        if (!InputValidators.ValuesEqual(dto.LastName, employee.LastName))
            InputValidators.ValidatePersonName(dto.LastName, "Last name");

        var phoneChanged = !InputValidators.ValuesEqual(dto.Phone, employee.Phone);
        var homePhoneChanged = !InputValidators.ValuesEqual(dto.HomeTelephone, employee.HomeTelephone);
        var workPhoneChanged = !InputValidators.ValuesEqual(dto.WorkTelephone, employee.WorkTelephone);
        if (phoneChanged)
        {
            dto.Phone = InputValidators.NormalizePhone(dto.Phone);
            InputValidators.ValidatePhone(dto.Phone, "Mobile phone", required: false);
        }
        if (homePhoneChanged)
        {
            dto.HomeTelephone = InputValidators.NormalizePhone(dto.HomeTelephone);
            InputValidators.ValidatePhone(dto.HomeTelephone, "Home telephone", required: false);
        }
        if (workPhoneChanged)
        {
            dto.WorkTelephone = InputValidators.NormalizePhone(dto.WorkTelephone);
            InputValidators.ValidatePhone(dto.WorkTelephone, "Work telephone", required: false);
        }

        var nicChanged = !InputValidators.ValuesEqual(dto.NationalId, employee.NationalId);
        if (nicChanged)
            InputValidators.ValidateNic(dto.NationalId, "NIC number", required: false);
        var dlChanged = !InputValidators.ValuesEqual(dto.DriversLicenseNumber, employee.DriversLicenseNumber);
        if (dlChanged)
            InputValidators.ValidateDrivingLicense(dto.DriversLicenseNumber, "Driving license number", required: false);

        var tinChanged = !InputValidators.ValuesEqual(
            InputValidators.NormalizeTin(dto.TinNumber),
            InputValidators.NormalizeTin(employee.TinNumber));
        if (tinChanged)
            InputValidators.ValidateTin(dto.TinNumber, "TIN number", required: false);

        var epfChanged = !InputValidators.StatutoryFundNumbersEqual(dto.EpfNumber, employee.EpfNumber);
        var etfChanged = !InputValidators.StatutoryFundNumbersEqual(dto.EtfNumber, employee.EtfNumber);
        if (epfChanged)
            InputValidators.ValidateEpfNumber(dto.EpfNumber, "EPF number", required: false);
        if (etfChanged)
            InputValidators.ValidateEtfNumber(dto.EtfNumber, "ETF number", required: false);

        var workEmailChanged = !InputValidators.ValuesEqual(
            EmployeeEmailHelper.NormalizeForSave(dto.Email),
            EmployeeEmailHelper.NormalizeForSave(employee.Email));
        var personalEmailChanged = !InputValidators.ValuesEqual(dto.OtherEmail, employee.OtherEmail);
        if (workEmailChanged)
            InputValidators.ValidateEmailInput(dto.Email, "Work email", required: false);
        if (personalEmailChanged)
            InputValidators.ValidateEmailInput(dto.OtherEmail, "Personal email", required: false);

        InputValidators.ValidateEmployeeAddressFieldsIfChanged(
            dto.AddressStreet1,
            dto.AddressStreet2,
            dto.City,
            dto.ZipPostalCode,
            dto.PollingDivision,
            dto.DistanceToOffice,
            dto.PermanentStreet1,
            dto.PermanentStreet2,
            dto.PermanentCity,
            dto.PermanentZipPostalCode,
            dto.PermanentPollingDivision,
            dto.PermanentDistanceToOffice,
            employee.AddressStreet1,
            employee.AddressStreet2,
            employee.City,
            employee.ZipPostalCode,
            employee.PollingDivision,
            employee.DistanceToOffice,
            employee.PermanentStreet1,
            employee.PermanentStreet2,
            employee.PermanentCity,
            employee.PermanentZipPostalCode,
            employee.PermanentPollingDivision,
            employee.PermanentDistanceToOffice);
        dto.TinNumber = tinChanged
            ? InputValidators.NormalizeTin(dto.TinNumber)
            : employee.TinNumber;
        dto.EpfNumber = epfChanged
            ? InputValidators.NormalizeStatutoryFundNumber(dto.EpfNumber)
            : employee.EpfNumber;
        dto.EtfNumber = etfChanged
            ? InputValidators.NormalizeStatutoryFundNumber(dto.EtfNumber)
            : employee.EtfNumber;

        var snapJoin = employee.JoinDate;
        var snapEmploymentType = employee.EmploymentType;
        var snapProbationEnd = employee.ProbationEndDate;
        var snapPermanency = employee.DateOfPermanency;
        var lifecycleBefore = CopyLifecycleSnapshot(employee);

        await EmployeeUniqueness.ValidateEmailForUpdateAsync(_db, id, dto.Email);
        var fingerprintId = EmployeeUniqueness.NormalizeFingerprintId(dto.FingerprintId);
        await EmployeeUniqueness.ValidateFingerprintIdAsync(_db, id, fingerprintId);
        var fingerprintChanged = !string.Equals(employee.FingerprintId, fingerprintId, StringComparison.OrdinalIgnoreCase);

        employee.FirstName = dto.FirstName;
        employee.MiddleName = dto.MiddleName;
        employee.LastName = dto.LastName;
        var normalizedEmail = EmployeeEmailHelper.NormalizeForSave(dto.Email);
        if (normalizedEmail != null)
            employee.Email = normalizedEmail;
        else if (EmployeeEmailHelper.IsPlaceholder(employee.Email))
        {
            // Job/Personal tabs send blank for hidden placeholders — keep the stored value.
        }
        else if (!string.IsNullOrWhiteSpace(employee.Email))
        {
            // Explicit clear of a real work email. Placeholder keeps NOT NULL DBs happy.
            employee.Email = EmployeeEmailHelper.ResolveForCreate(employee.EmployeeCode, null);
        }
        employee.Phone = dto.Phone;
        employee.DateOfBirth = ToWallDate(dto.DateOfBirth);
        employee.Gender = ParseGender(dto.Gender);
        employee.MaritalStatus = dto.MaritalStatus;
        employee.Nationality = dto.Nationality;
        employee.Religion = dto.Religion;
        employee.Ethnicity = dto.Ethnicity;
        employee.OtherId = dto.OtherId;
        employee.FingerprintId = fingerprintId;
        employee.NationalId = dto.NationalId;
        employee.TinNumber = dto.TinNumber;
        employee.EpfNumber = dto.EpfNumber;
        employee.EtfNumber = dto.EtfNumber;
        employee.DriversLicenseNumber = dto.DriversLicenseNumber;
        employee.DriversLicenseType = dto.DriversLicenseType;
        employee.LicenseIssueDate = dto.LicenseIssueDate.HasValue ? ToWallDate(dto.LicenseIssueDate.Value) : null;
        employee.LicenseExpiryDate = dto.LicenseExpiryDate.HasValue ? ToWallDate(dto.LicenseExpiryDate.Value) : null;
        employee.DriversLicenseIssuingCountry = dto.DriversLicenseIssuingCountry;
        employee.AddressStreet1 = dto.AddressStreet1;
        employee.AddressStreet2 = dto.AddressStreet2;
        employee.City = dto.City;
        employee.Country = dto.Country;
        employee.StateProvince = dto.StateProvince;
        employee.ZipPostalCode = dto.ZipPostalCode;
        employee.District = dto.District;
        employee.PollingDivision = dto.PollingDivision;
        employee.DistanceToOffice = dto.DistanceToOffice;
        employee.ModeOfTransport = dto.ModeOfTransport;
        employee.HomeTelephone = dto.HomeTelephone;
        employee.WorkTelephone = dto.WorkTelephone;
        employee.OtherEmail = dto.OtherEmail;
        employee.PermanentStreet1 = dto.PermanentStreet1;
        employee.PermanentStreet2 = dto.PermanentStreet2;
        employee.PermanentCity = dto.PermanentCity;
        employee.PermanentCountry = dto.PermanentCountry;
        employee.PermanentStateProvince = dto.PermanentStateProvince;
        employee.PermanentZipPostalCode = dto.PermanentZipPostalCode;
        employee.PermanentDistrict = dto.PermanentDistrict;
        employee.PermanentPollingDivision = dto.PermanentPollingDivision;
        employee.PermanentDistanceToOffice = dto.PermanentDistanceToOffice;
        if (dto.JoinDate.HasValue) employee.JoinDate = ToWallDate(dto.JoinDate.Value);
        employee.ProbationEndDate = dto.ProbationEndDate.HasValue ? ToWallDate(dto.ProbationEndDate.Value) : null;
        employee.DateOfPermanency = dto.DateOfPermanency.HasValue ? ToWallDate(dto.DateOfPermanency.Value) : null;
        employee.Status = dto.Status;
        employee.EmploymentType = dto.EmploymentType;
        employee.TerminationDate = dto.TerminationDate.HasValue ? ToWallDate(dto.TerminationDate.Value) : null;
        employee.TerminationReason = dto.TerminationReason;
        employee.TerminationNote = dto.TerminationNote;
        employee.DepartmentId = dto.DepartmentId;
        employee.BusinessUnitId = dto.BusinessUnitId;
        employee.PositionId = dto.PositionId;
        employee.LocationId = dto.LocationId;
        employee.GradeId = dto.GradeId;
        employee.JobTitleId = dto.JobTitleId;
        employee.ManagerId = dto.ManagerId;
        employee.IsTopOfHierarchy = dto.IsTopOfHierarchy;

        await _db.SaveChangesAsync();

        if (fingerprintChanged && fingerprintId != null)
            await ResetBiometricPunchesForFingerprintIdAsync(fingerprintId);

        try
        {
            await _lifecycleService.RecordEmployeeUpdateAsync(lifecycleBefore, employee);
        }
        catch
        {
            // Timeline history must not roll back a successful job/org update.
        }

        var joinChanged = dto.JoinDate.HasValue && employee.JoinDate.Date != snapJoin.Date;
        var employmentChanged = !string.Equals(employee.EmploymentType, snapEmploymentType, StringComparison.Ordinal);
        var probationEndChanged = employee.ProbationEndDate?.Date != snapProbationEnd?.Date;
        var permanencyChanged = employee.DateOfPermanency?.Date != snapPermanency?.Date;

        if (joinChanged || employmentChanged || probationEndChanged || permanencyChanged)
        {
            try
            {
                var years = new SortedSet<int> { DateTime.UtcNow.Year, DateTime.UtcNow.Year - 1 };
                foreach (var y in years)
                    await _entitlementService.CalculateAndApplyAsync(id, y);
            }
            catch
            {
                // Leave balances can be recalculated from Leave admin; do not fail the employee update.
            }
        }

        return (await GetByIdAsync(id))!;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null || employee.IsDeleted) return false;

        var status = employee.Status?.Trim() ?? "";
        if (!string.Equals(status, "Terminated", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(status, "Retired", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                "Only terminated or retired employees can be deleted.");
        }

        employee.IsDeleted = true;
        employee.Email = EmployeeUniqueness.ArchiveEmail(employee.Id, employee.Email);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.EmployeeId == id && !u.IsDeleted);
        if (user is not null)
            user.IsActive = false;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> UpdateProfileImageAsync(Guid id, string imageUrl)
    {
        var employee = await _db.Employees.FirstOrDefaultAsync(e => e.Id == id);
        if (employee is null) return null;

        employee.ProfileImageUrl = imageUrl;
        await _db.SaveChangesAsync();
        return imageUrl;
    }

    public async Task<PagedResult<PeopleAuditLogEntryDto>> GetPeopleAuditTrailAsync(
        Guid? subjectEmployeeId,
        string? employeeSearch,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        int page = 1,
        int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        Guid? resolvedSubjectId = subjectEmployeeId;
        List<Guid>? subjectIdFilter = null;

        if (!resolvedSubjectId.HasValue && !string.IsNullOrWhiteSpace(employeeSearch))
        {
            var term = employeeSearch.Trim();
            if (Guid.TryParse(term, out var parsed))
            {
                resolvedSubjectId = parsed;
            }
            else
            {
                var t = term.ToLower();
                var employeeQuery = _db.Employees.AsNoTracking().Where(e => !e.IsDeleted);
                if (allowedEmployeeIds != null)
                    employeeQuery = employeeQuery.Where(e => allowedEmployeeIds.Contains(e.Id));

                subjectIdFilter = await employeeQuery
                    .Where(e =>
                        e.EmployeeCode.ToLower().Contains(t) ||
                        e.FirstName.ToLower().Contains(t) ||
                        e.LastName.ToLower().Contains(t) ||
                        (e.FirstName + " " + e.LastName).ToLower().Contains(t) ||
                        (e.MiddleName != null && e.MiddleName.ToLower().Contains(t)))
                    .Select(e => e.Id)
                    .ToListAsync();

                if (subjectIdFilter.Count == 0)
                {
                    return new PagedResult<PeopleAuditLogEntryDto>
                    {
                        Items = Array.Empty<PeopleAuditLogEntryDto>(),
                        TotalCount = 0,
                        Page = page,
                        PageSize = pageSize,
                    };
                }
            }
        }

        if (resolvedSubjectId.HasValue && allowedEmployeeIds != null && !allowedEmployeeIds.Contains(resolvedSubjectId.Value))
        {
            return new PagedResult<PeopleAuditLogEntryDto>
            {
                Items = Array.Empty<PeopleAuditLogEntryDto>(),
                TotalCount = 0,
                Page = page,
                PageSize = pageSize,
            };
        }

        var query = _db.AuditLogs.AsNoTracking()
            .Where(a => !a.IsDeleted && a.Module == PeopleHubAuditSaveChangesInterceptor.PeopleModule);

        if (resolvedSubjectId.HasValue)
            query = query.Where(a => a.SubjectEmployeeId == resolvedSubjectId.Value);
        else if (subjectIdFilter != null)
            query = query.Where(a => a.SubjectEmployeeId != null && subjectIdFilter.Contains(a.SubjectEmployeeId.Value));
        else if (allowedEmployeeIds != null)
            query = query.Where(a => a.SubjectEmployeeId != null && allowedEmployeeIds.Contains(a.SubjectEmployeeId.Value));

        var total = await query.CountAsync();
        var items = await query.OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new PeopleAuditLogEntryDto
            {
                Id = a.Id,
                EntityName = a.EntityName,
                EntityId = a.EntityId,
                Action = a.Action,
                SubjectEmployeeId = a.SubjectEmployeeId,
                UserId = a.UserId,
                UserName = a.UserName,
                Timestamp = a.Timestamp,
                OldValues = a.OldValues,
                NewValues = a.NewValues,
            })
            .ToListAsync();

        await PeopleAuditTrailEnricher.EnrichAsync(items, _db);

        return new PagedResult<PeopleAuditLogEntryDto>
        {
            Items = items,
            TotalCount = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    private static EmployeeDto MapToDto(Employee e) => new()
    {
        Id = e.Id,
        EmployeeCode = e.EmployeeCode,
        FirstName = e.FirstName,
        MiddleName = e.MiddleName,
        LastName = e.LastName,
        FullName = e.FullName,
        Email = EmployeeEmailHelper.ToDisplayEmail(e.Email) ?? string.Empty,
        Phone = e.Phone,
        AddressStreet1 = e.AddressStreet1,
        AddressStreet2 = e.AddressStreet2,
        City = e.City,
        Country = e.Country,
        StateProvince = e.StateProvince,
        ZipPostalCode = e.ZipPostalCode,
        District = e.District,
        PollingDivision = e.PollingDivision,
        DistanceToOffice = e.DistanceToOffice,
        ModeOfTransport = e.ModeOfTransport,
        HomeTelephone = e.HomeTelephone,
        WorkTelephone = e.WorkTelephone,
        OtherEmail = e.OtherEmail,
        PermanentStreet1 = e.PermanentStreet1,
        PermanentStreet2 = e.PermanentStreet2,
        PermanentCity = e.PermanentCity,
        PermanentCountry = e.PermanentCountry,
        PermanentStateProvince = e.PermanentStateProvince,
        PermanentZipPostalCode = e.PermanentZipPostalCode,
        PermanentDistrict = e.PermanentDistrict,
        PermanentPollingDivision = e.PermanentPollingDivision,
        PermanentDistanceToOffice = e.PermanentDistanceToOffice,
        DateOfBirth = e.DateOfBirth,
        Gender = e.Gender.ToString(),
        MaritalStatus = e.MaritalStatus,
        Nationality = e.Nationality,
        Religion = e.Religion,
        Ethnicity = e.Ethnicity,
        OtherId = e.OtherId,
        FingerprintId = e.FingerprintId,
        NationalId = e.NationalId,
        TinNumber = e.TinNumber,
        EpfNumber = e.EpfNumber,
        EtfNumber = e.EtfNumber,
        DriversLicenseNumber = e.DriversLicenseNumber,
        DriversLicenseType = e.DriversLicenseType,
        LicenseIssueDate = e.LicenseIssueDate,
        LicenseExpiryDate = e.LicenseExpiryDate,
        DriversLicenseIssuingCountry = e.DriversLicenseIssuingCountry,
        JoinDate = e.JoinDate,
        ProbationEndDate = e.ProbationEndDate,
        DateOfPermanency = e.DateOfPermanency,
        TerminationDate = e.TerminationDate,
        TerminationReason = e.TerminationReason,
        TerminationNote = e.TerminationNote,
        Status = e.Status.ToString(),
        EmploymentType = e.EmploymentType,
        DepartmentId = e.DepartmentId,
        DepartmentName = e.Department?.Name,
        BusinessUnitId = e.BusinessUnitId,
        BusinessUnitName = e.BusinessUnit?.Name,
        PositionId = e.PositionId,
        PositionTitle = e.Position?.Title,
        LocationId = e.LocationId,
        LocationName = e.Location?.Name,
        GradeId = e.GradeId,
        GradeName = e.Grade?.Name,
        JobTitleId = e.JobTitleId,
        JobTitleName = e.JobTitle?.Title,
        JobTitleDescription = e.JobTitle?.Description,
        ManagerId = e.ManagerId,
        ManagerName = e.Manager != null ? $"{e.Manager.FirstName} {e.Manager.LastName}" : null,
        ProfileImageUrl = e.ProfileImageUrl,
        IsTopOfHierarchy = e.IsTopOfHierarchy,
        ShiftPatternId = e.ShiftPatternId,
        ShiftPatternName = e.ShiftPattern?.Name,
        ShiftPatternCode = e.ShiftPattern?.Code,
    };

    private static Employee CopyLifecycleSnapshot(Employee e) => new()
    {
        Id = e.Id,
        JoinDate = e.JoinDate,
        ProbationEndDate = e.ProbationEndDate,
        DateOfPermanency = e.DateOfPermanency,
        TerminationDate = e.TerminationDate,
        TerminationReason = e.TerminationReason,
        Status = e.Status,
        EmploymentType = e.EmploymentType,
        DepartmentId = e.DepartmentId,
        BusinessUnitId = e.BusinessUnitId,
        PositionId = e.PositionId,
        LocationId = e.LocationId,
        GradeId = e.GradeId,
        JobTitleId = e.JobTitleId,
        ManagerId = e.ManagerId,
    };

    private static Gender ParseGender(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Gender is required.");

        if (!Enum.TryParse<Gender>(value.Trim(), ignoreCase: true, out var gender)
            || !Enum.IsDefined(typeof(Gender), gender))
        {
            throw new InvalidOperationException("Gender must be Male, Female, or Other.");
        }

        return gender;
    }

    private static DateTime ToWallDate(DateTime value)
    {
        if (value == default)
            return value;
        return DateTime.SpecifyKind(value.Date, DateTimeKind.Unspecified);
    }

    /// <summary>
    /// When a Fingerprint ID is set/changed, re-queue punches for that device PIN so the ADMS processor can map them.
    /// </summary>
    private async Task ResetBiometricPunchesForFingerprintIdAsync(string fingerprintId)
    {
        var aliases = BiometricEmployeeResolver.GetAliases(fingerprintId);
        if (aliases.Count == 0) return;

        var aliasSet = new HashSet<string>(aliases, StringComparer.OrdinalIgnoreCase);

        // Match exact DeviceUserId and leading-zero variants (same rules as biometric resolve).
        var candidates = await _db.BiometricPunchEvents
            .Where(p => !p.IsDeleted && p.ProcessedToAttendance)
            .Select(p => new { p.Id, p.DeviceUserId })
            .ToListAsync();

        var idsToReset = candidates
            .Where(p =>
            {
                var key = p.DeviceUserId?.Trim() ?? string.Empty;
                if (string.IsNullOrEmpty(key)) return false;
                if (aliasSet.Contains(key)) return true;
                var trimmed = key.TrimStart('0');
                return !string.IsNullOrEmpty(trimmed) && aliasSet.Contains(trimmed);
            })
            .Select(p => p.Id)
            .ToList();

        if (idsToReset.Count == 0) return;

        var punches = await _db.BiometricPunchEvents
            .Where(p => idsToReset.Contains(p.Id))
            .ToListAsync();

        foreach (var punch in punches)
            punch.ProcessedToAttendance = false;

        await _db.SaveChangesAsync();
    }
}
