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

    public EmployeeService(AppDbContext db, ISystemSettingService settings, ILeaveEntitlementService entitlementService)
    {
        _db = db;
        _settings = settings;
        _entitlementService = entitlementService;
    }

    /// <summary>Stable local-part for placeholder work email when none is provided (employee code is unique).</summary>
    private static string SanitizeForNoEmailLocalPart(string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return $"e-{Guid.NewGuid():N}";
        var s = Regex.Replace(code.Trim(), @"[^\w\-\.]", "_");
        return string.IsNullOrEmpty(s) ? $"e-{Guid.NewGuid():N}" : s;
    }

    private static IQueryable<Employee> ApplyEmployeeListSort(IQueryable<Employee> query, string? sortBy, string? sortDir)
    {
        var key = (sortBy ?? "employeeCode").Trim().ToLowerInvariant();
        var asc = !string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase);

        return key switch
        {
            "name" or "fullname" => asc
                ? query.OrderBy(e => e.LastName).ThenBy(e => e.FirstName).ThenBy(e => e.MiddleName)
                : query.OrderByDescending(e => e.LastName).ThenByDescending(e => e.FirstName).ThenByDescending(e => e.MiddleName),
            "jobtitle" => asc
                ? query.OrderBy(e => (e.JobTitle != null ? e.JobTitle.Title : null) ?? (e.Position != null ? e.Position.Title : null) ?? "")
                : query.OrderByDescending(e => (e.JobTitle != null ? e.JobTitle.Title : null) ?? (e.Position != null ? e.Position.Title : null) ?? ""),
            "status" => asc ? query.OrderBy(e => e.Status) : query.OrderByDescending(e => e.Status),
            "employmenttype" => asc ? query.OrderBy(e => e.EmploymentType) : query.OrderByDescending(e => e.EmploymentType),
            "department" => asc
                ? query.OrderBy(e => e.Department != null ? e.Department.Name : "")
                : query.OrderByDescending(e => e.Department != null ? e.Department.Name : ""),
            "location" => asc
                ? query.OrderBy(e => e.Location != null ? e.Location.Name : "")
                : query.OrderByDescending(e => e.Location != null ? e.Location.Name : ""),
            "supervisor" or "manager" => asc
                ? query.OrderBy(e => e.Manager != null ? e.Manager.LastName : "").ThenBy(e => e.Manager != null ? e.Manager.FirstName : "")
                : query.OrderByDescending(e => e.Manager != null ? e.Manager.LastName : "").ThenByDescending(e => e.Manager != null ? e.Manager.FirstName : ""),
            _ => asc ? query.OrderBy(e => e.EmployeeCode) : query.OrderByDescending(e => e.EmployeeCode),
        };
    }

    private async Task<Dictionary<Guid, string>> GetDirectSupervisorMapAsync(IEnumerable<Guid> employeeIds)
    {
        var supervisors = await _db.Set<EmployeeSupervisor>()
            .Include(s => s.Supervisor)
            .Where(s => !s.IsDeleted && s.ReportingMethod == "Direct" && employeeIds.Contains(s.EmployeeId))
            .Select(s => new { s.EmployeeId, SupervisorName = s.Supervisor.FirstName + " " + s.Supervisor.LastName })
            .ToListAsync();
        return supervisors
            .GroupBy(s => s.EmployeeId)
            .ToDictionary(g => g.Key, g => g.First().SupervisorName);
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLower();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(term) ||
                e.LastName.ToLower().Contains(term) ||
                (e.MiddleName != null && e.MiddleName.ToLower().Contains(term)) ||
                e.EmployeeCode.ToLower().Contains(term) ||
                e.Email.ToLower().Contains(term));
        }

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

        if (allowedEmployeeIds != null && allowedEmployeeIds.Count > 0)
            query = query.Where(e => allowedEmployeeIds.Contains(e.Id));

        query = ApplyEmployeeListSort(query, sortBy, sortDir);

        var totalCount = await query.CountAsync();

        var entities = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = entities.Select(e => MapToDto(e)).ToList();

        var empIds = items.Select(i => i.Id).ToList();
        var supMap = await GetDirectSupervisorMapAsync(empIds);
        foreach (var item in items)
        {
            item.HasDirectSupervisor = supMap.ContainsKey(item.Id);
            if (supMap.TryGetValue(item.Id, out var supName))
                item.ManagerName = supName;
        }

        return new PagedResult<EmployeeDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize
        };
    }

    public async Task<EmployeeDto?> GetByIdAsync(Guid id, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        if (allowedEmployeeIds != null && allowedEmployeeIds.Count > 0 && !allowedEmployeeIds.Contains(id))
            return null;

        var employee = await _db.Employees
            .Include(e => e.Department)
            .Include(e => e.BusinessUnit)
            .Include(e => e.Position)
            .Include(e => e.Location)
            .Include(e => e.Grade)
            .Include(e => e.JobTitle)
            .Include(e => e.Manager)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee is null) return null;
        var dto = MapToDto(employee);
        var supMap = await GetDirectSupervisorMapAsync(new[] { employee.Id });
        dto.HasDirectSupervisor = supMap.ContainsKey(employee.Id);
        if (supMap.TryGetValue(employee.Id, out var supName))
            dto.ManagerName = supName;
        return dto;
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeDto dto)
    {
        var code = string.IsNullOrWhiteSpace(dto.EmployeeCode)
            ? await _settings.GenerateNextEmployeeCodeAsync()
            : dto.EmployeeCode;

        var resolvedEmail = string.IsNullOrWhiteSpace(dto.Email)
            ? $"{SanitizeForNoEmailLocalPart(code)}@employee.noemail.opensky.hrm"
            : dto.Email.Trim();

        var employee = new Employee
        {
            EmployeeCode = code,
            FirstName = dto.FirstName,
            MiddleName = dto.MiddleName,
            LastName = dto.LastName,
            Email = resolvedEmail,
            Phone = dto.Phone,
            DateOfBirth = dto.DateOfBirth,
            Gender = Enum.Parse<Gender>(dto.Gender, true),
            MaritalStatus = dto.MaritalStatus,
            Nationality = dto.Nationality,
            Religion = dto.Religion,
            Ethnicity = dto.Ethnicity,
            OtherId = dto.OtherId,
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

        var calendarYear = DateTime.UtcNow.Year;
        await _entitlementService.CalculateAndApplyAsync(employee.Id, calendarYear);
        if (employee.JoinDate.Year != calendarYear)
            await _entitlementService.CalculateAndApplyAsync(employee.Id, employee.JoinDate.Year);

        return (await GetByIdAsync(employee.Id))!;
    }

    public async Task<EmployeeDto?> UpdateAsync(Guid id, UpdateEmployeeDto dto)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return null;

        var snapJoin = employee.JoinDate;
        var snapEmploymentType = employee.EmploymentType;
        var snapProbationEnd = employee.ProbationEndDate;
        var snapPermanency = employee.DateOfPermanency;

        employee.FirstName = dto.FirstName;
        employee.MiddleName = dto.MiddleName;
        employee.LastName = dto.LastName;
        employee.Email = dto.Email;
        employee.Phone = dto.Phone;
        employee.DateOfBirth = dto.DateOfBirth;
        employee.Gender = Enum.Parse<Gender>(dto.Gender, true);
        employee.MaritalStatus = dto.MaritalStatus;
        employee.Nationality = dto.Nationality;
        employee.Religion = dto.Religion;
        employee.Ethnicity = dto.Ethnicity;
        employee.OtherId = dto.OtherId;
        employee.NationalId = dto.NationalId;
        employee.TinNumber = dto.TinNumber;
        employee.EpfNumber = dto.EpfNumber;
        employee.EtfNumber = dto.EtfNumber;
        employee.DriversLicenseNumber = dto.DriversLicenseNumber;
        employee.DriversLicenseType = dto.DriversLicenseType;
        employee.LicenseIssueDate = dto.LicenseIssueDate;
        employee.LicenseExpiryDate = dto.LicenseExpiryDate;
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
        if (dto.JoinDate.HasValue) employee.JoinDate = dto.JoinDate.Value;
        employee.ProbationEndDate = dto.ProbationEndDate;
        employee.DateOfPermanency = dto.DateOfPermanency;
        employee.Status = dto.Status;
        employee.EmploymentType = dto.EmploymentType;
        employee.TerminationDate = dto.TerminationDate;
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

        var joinChanged = dto.JoinDate.HasValue && employee.JoinDate != snapJoin;
        var employmentChanged = !string.Equals(employee.EmploymentType, snapEmploymentType, StringComparison.Ordinal);
        var probationEndChanged = employee.ProbationEndDate != snapProbationEnd;
        var permanencyChanged = employee.DateOfPermanency != snapPermanency;

        if (joinChanged || employmentChanged || probationEndChanged || permanencyChanged)
        {
            var years = new SortedSet<int> { DateTime.UtcNow.Year, DateTime.UtcNow.Year - 1 };
            foreach (var y in years)
                await _entitlementService.CalculateAndApplyAsync(id, y);
        }

        return (await GetByIdAsync(id))!;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return false;

        employee.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<string?> UpdateProfileImageAsync(Guid id, string imageUrl)
    {
        var employee = await _db.Employees.FindAsync(id);
        if (employee is null) return null;

        employee.ProfileImageUrl = imageUrl;
        await _db.SaveChangesAsync();
        return imageUrl;
    }

    public async Task<PagedResult<PeopleAuditLogEntryDto>> GetPeopleAuditTrailAsync(
        Guid? subjectEmployeeId,
        IReadOnlyList<Guid>? allowedEmployeeIds,
        int page = 1,
        int pageSize = 50)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 50;
        if (pageSize > 200) pageSize = 200;

        if (subjectEmployeeId.HasValue && allowedEmployeeIds != null && !allowedEmployeeIds.Contains(subjectEmployeeId.Value))
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

        if (subjectEmployeeId.HasValue)
            query = query.Where(a => a.SubjectEmployeeId == subjectEmployeeId.Value);
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
        Email = e.Email,
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
    };
}
