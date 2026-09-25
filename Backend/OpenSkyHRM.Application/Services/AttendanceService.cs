using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AttendanceService : IAttendanceService
{
    private readonly AppDbContext _db;
    private readonly ISystemSettingService _settings;
    private readonly IBusinessClock _clock;

    public AttendanceService(AppDbContext db, ISystemSettingService settings, IBusinessClock clock)
    {
        _db = db;
        _settings = settings;
        _clock = clock;
    }

    public async Task<PagedResult<AttendanceRecordDto>> GetAttendanceAsync(
        int page = 1, int pageSize = 20, Guid? employeeId = null,
        DateTime? fromDate = null, DateTime? toDate = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        Guid? departmentId = null, Guid? locationId = null, string? status = null, string? source = null,
        string? sortBy = null, string? sortDir = null)
    {
        var today = _clock.Now.Date;
        var from = fromDate?.Date ?? today;
        var to = toDate?.Date ?? today;
        if (to < from) to = from;
        // Inclusive calendar range: Date may carry a time-of-day from older rows / imports.
        var toExclusive = to.AddDays(1);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var spanDays = (to - from).TotalDays + 1;
        var includeOnLeave = spanDays <= 7;
        var statusFilter = string.IsNullOrWhiteSpace(status) ? null : status.Trim();
        var sourceFilter = string.IsNullOrWhiteSpace(source) ? null : source.Trim();
        var onLeaveStatusOnly = statusFilter != null
            && statusFilter.Equals("On Leave", StringComparison.OrdinalIgnoreCase);
        var includeLeaveOnlyRows = includeOnLeave
            && (statusFilter == null || onLeaveStatusOnly)
            && (sourceFilter == null || sourceFilter.Equals("System", StringComparison.OrdinalIgnoreCase));

        var query = _db.Set<AttendanceRecord>()
            .AsNoTracking()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.Date >= from && a.Date < toExclusive);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));
        query = ApplyAttendanceRecordFilters(query, departmentId, locationId, statusFilter, sourceFilter, onLeaveStatusOnly);

        if (includeOnLeave)
        {
            var rawItems = await query
                .ToListAsync();

            var recordsSet = rawItems.Select(a => (a.EmployeeId, a.Date)).ToHashSet();
            var employeeIdsFromRecords = rawItems.Select(r => r.EmployeeId).Distinct().ToList();
            var rosterAssignments = await LoadRosterAssignmentsAsync(employeeIdsFromRecords);
            var onLeaveSet = await GetApprovedLeaveDatesAsync(employeeIdsFromRecords, from, to);
            var realDtos = CollapseToFirstInLastOut(
                rawItems
                    .Select(a => MapToDto(a, rosterAssignments, onLeaveSet.Contains((a.EmployeeId, a.Date))))
                    .Where(dto => MatchesAttendanceDtoFilters(dto, statusFilter, sourceFilter))
                    .ToList());

            var leaveOnlySet = includeLeaveOnlyRows
                ? await GetLeaveOnlyDatesAsync(from, to, employeeId, allowedEmployeeIds, recordsSet, departmentId, locationId)
                : new HashSet<(Guid EmployeeId, DateTime Date)>();
            var syntheticDtos = await BuildLeaveOnlyDtosAsync(leaveOnlySet);

            var combined = SortAttendanceDtos(realDtos.Concat(syntheticDtos).ToList(), sortBy, sortDir);

            var items = combined
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return new PagedResult<AttendanceRecordDto>
            {
                Items = items,
                TotalCount = combined.Count,
                Page = page,
                PageSize = pageSize,
            };
        }

        var attendanceTotal = await query.CountAsync();
        var pageItems = await ApplyAttendanceListSort(query, sortBy, sortDir)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var pageEmployeeIds = pageItems.Select(r => r.EmployeeId).Distinct().ToList();
        var pageRosters = await LoadRosterAssignmentsAsync(pageEmployeeIds);
        var pageOnLeave = await GetApprovedLeaveDatesAsync(pageEmployeeIds, from, to);
        var dtos = SortAttendanceDtos(
            CollapseToFirstInLastOut(
                pageItems
                    .Select(a => MapToDto(a, pageRosters, pageOnLeave.Contains((a.EmployeeId, a.Date))))
                    .Where(dto => MatchesAttendanceDtoFilters(dto, statusFilter, sourceFilter))
                    .ToList()),
            sortBy,
            sortDir);

        return new PagedResult<AttendanceRecordDto>
        {
            Items = dtos,
            Page = page,
            PageSize = pageSize,
            TotalCount = attendanceTotal,
        };
    }

    private static IQueryable<AttendanceRecord> ApplyAttendanceRecordFilters(
        IQueryable<AttendanceRecord> query,
        Guid? departmentId,
        Guid? locationId,
        string? statusFilter,
        string? sourceFilter,
        bool onLeaveStatusOnly)
    {
        if (departmentId.HasValue)
            query = query.Where(a => a.Employee.DepartmentId == departmentId.Value);
        if (locationId.HasValue)
            query = query.Where(a => a.Employee.LocationId == locationId.Value);
        if (sourceFilter != null && !sourceFilter.Equals("System", StringComparison.OrdinalIgnoreCase))
            query = query.Where(a => a.Source == sourceFilter);
        if (statusFilter != null && !onLeaveStatusOnly)
            query = query.Where(a => a.Status == statusFilter);
        if (onLeaveStatusOnly)
            query = query.Where(a => false);
        return query;
    }

    private static bool MatchesAttendanceDtoFilters(AttendanceRecordDto dto, string? statusFilter, string? sourceFilter)
    {
        if (statusFilter != null && !dto.Status.Equals(statusFilter, StringComparison.OrdinalIgnoreCase))
            return false;
        if (sourceFilter != null && !string.Equals(dto.Source, sourceFilter, StringComparison.OrdinalIgnoreCase))
            return false;
        return true;
    }

    private static string NormalizeSortKey(string? sortBy)
    {
        var key = (sortBy ?? "date").Trim().ToLowerInvariant();
        return key switch
        {
            "employeename" => "employee",
            "workedhours" or "worked_hours" => "hours",
            "punch_in" => "punchin",
            "punch_out" => "punchout",
            _ => key,
        };
    }

    private static IQueryable<AttendanceRecord> ApplyAttendanceListSort(
        IQueryable<AttendanceRecord> query, string? sortBy, string? sortDir)
    {
        var key = NormalizeSortKey(sortBy);
        var asc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

        return key switch
        {
            "employee" => asc
                ? query.OrderBy(a => a.Employee.LastName).ThenBy(a => a.Employee.FirstName).ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.Employee.LastName).ThenByDescending(a => a.Employee.FirstName).ThenByDescending(a => a.Date),
            "punchin" => asc
                ? query.OrderBy(a => a.PunchIn).ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.PunchIn).ThenByDescending(a => a.Date),
            "punchout" => asc
                ? query.OrderBy(a => a.PunchOut).ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.PunchOut).ThenByDescending(a => a.Date),
            "hours" => asc
                ? query.OrderBy(a => a.WorkedHours).ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.WorkedHours).ThenByDescending(a => a.Date),
            "status" => asc
                ? query.OrderBy(a => a.Status).ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.Status).ThenByDescending(a => a.Date),
            "source" => asc
                ? query.OrderBy(a => a.Source ?? "").ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.Source ?? "").ThenByDescending(a => a.Date),
            "shift" => asc
                ? query.OrderBy(a => a.Employee.ShiftPattern != null ? a.Employee.ShiftPattern.Name : "").ThenByDescending(a => a.Date)
                : query.OrderByDescending(a => a.Employee.ShiftPattern != null ? a.Employee.ShiftPattern.Name : "").ThenByDescending(a => a.Date),
            "date" => asc
                ? query.OrderBy(a => a.Date).ThenBy(a => a.Employee!.FirstName)
                : query.OrderByDescending(a => a.Date).ThenBy(a => a.Employee!.FirstName),
            _ => query.OrderByDescending(a => a.Date).ThenBy(a => a.Employee!.FirstName),
        };
    }

    private static List<AttendanceRecordDto> SortAttendanceDtos(
        List<AttendanceRecordDto> items, string? sortBy, string? sortDir)
    {
        if (items.Count <= 1) return items;

        var key = NormalizeSortKey(sortBy);
        var asc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);

        IEnumerable<AttendanceRecordDto> ordered = key switch
        {
            "employee" => asc
                ? items.OrderBy(x => x.EmployeeName, StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.EmployeeName, StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date),
            "punchin" => asc
                ? items.OrderBy(x => x.PunchIn).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.PunchIn).ThenByDescending(x => x.Date),
            "punchout" => asc
                ? items.OrderBy(x => x.PunchOut).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.PunchOut).ThenByDescending(x => x.Date),
            "hours" => asc
                ? items.OrderBy(x => x.WorkedHours).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.WorkedHours).ThenByDescending(x => x.Date),
            "status" => asc
                ? items.OrderBy(x => x.Status, StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.Status, StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date),
            "source" => asc
                ? items.OrderBy(x => x.Source ?? "", StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.Source ?? "", StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date),
            "shift" => asc
                ? items.OrderBy(x => x.ShiftName ?? "", StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date)
                : items.OrderByDescending(x => x.ShiftName ?? "", StringComparer.OrdinalIgnoreCase).ThenByDescending(x => x.Date),
            "date" => asc
                ? items.OrderBy(x => x.Date).ThenBy(x => x.EmployeeName, StringComparer.OrdinalIgnoreCase)
                : items.OrderByDescending(x => x.Date).ThenBy(x => x.EmployeeName, StringComparer.OrdinalIgnoreCase),
            // Prefer open sessions, then latest punch-in (supports multiple in/out cycles per day).
            _ => items
                .OrderByDescending(x => x.Date)
                .ThenByDescending(x => x.PunchIn != null && x.PunchOut == null)
                .ThenByDescending(x => x.PunchIn),
        };

        return ordered.ToList();
    }

    private async Task<List<RosterAssignment>> LoadRosterAssignmentsAsync(List<Guid> employeeIds)
    {
        if (employeeIds.Count == 0) return new List<RosterAssignment>();

        return await _db.Set<RosterAssignment>()
            .AsNoTracking()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt!.DefaultShiftPattern)
            .Where(ra => employeeIds.Contains(ra.EmployeeId))
            .ToListAsync();
    }

    /// <summary>
    /// Returns (EmployeeId, Date) pairs that have approved leave in range and no attendance record.
    /// </summary>
    private async Task<HashSet<(Guid EmployeeId, DateTime Date)>> GetLeaveOnlyDatesAsync(
        DateTime from, DateTime to, Guid? employeeId, IReadOnlyList<Guid>? allowedEmployeeIds,
        HashSet<(Guid EmployeeId, DateTime Date)> recordsSet,
        Guid? departmentId = null, Guid? locationId = null)
    {
        var leaveQuery = _db.Set<LeaveRequest>()
            .Where(lr => lr.Status == ApprovalStatus.Approved
                && lr.StartDate.Date <= to
                && lr.EndDate.Date >= from);

        if (employeeId.HasValue)
            leaveQuery = leaveQuery.Where(lr => lr.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            leaveQuery = leaveQuery.Where(lr => allowedEmployeeIds.Contains(lr.EmployeeId));
        if (departmentId.HasValue || locationId.HasValue)
        {
            var employeeQuery = _db.Employees.AsNoTracking().Where(e => !e.IsDeleted);
            if (departmentId.HasValue)
                employeeQuery = employeeQuery.Where(e => e.DepartmentId == departmentId.Value);
            if (locationId.HasValue)
                employeeQuery = employeeQuery.Where(e => e.LocationId == locationId.Value);
            var filteredEmployeeIds = await employeeQuery.Select(e => e.Id).ToListAsync();
            leaveQuery = leaveQuery.Where(lr => filteredEmployeeIds.Contains(lr.EmployeeId));
        }

        var leaves = await leaveQuery
            .Select(lr => new { lr.EmployeeId, lr.StartDate, lr.EndDate })
            .ToListAsync();

        var leaveSet = new HashSet<(Guid, DateTime)>();
        foreach (var l in leaves)
        {
            for (var d = l.StartDate.Date; d <= l.EndDate.Date; d = d.AddDays(1))
            {
                if (d >= from && d <= to && !recordsSet.Contains((l.EmployeeId, d)))
                    leaveSet.Add((l.EmployeeId, d));
            }
        }
        return leaveSet;
    }

    private async Task<List<AttendanceRecordDto>> BuildLeaveOnlyDtosAsync(HashSet<(Guid EmployeeId, DateTime Date)> leaveOnlySet)
    {
        if (leaveOnlySet.Count == 0) return new List<AttendanceRecordDto>();

        var empIds = leaveOnlySet.Select(x => x.EmployeeId).Distinct().ToList();
        var employees = await _db.Employees
            .Where(e => empIds.Contains(e.Id))
            .Select(e => new { e.Id, e.FirstName, e.LastName, e.EmployeeCode })
            .ToListAsync();

        var empLookup = employees.ToDictionary(e => e.Id);

        return leaveOnlySet
            .Where(x => empLookup.ContainsKey(x.EmployeeId))
            .Select(x =>
            {
                var emp = empLookup[x.EmployeeId];
                return new AttendanceRecordDto
                {
                    Id = Guid.Empty,
                    EmployeeId = x.EmployeeId,
                    EmployeeName = emp.FirstName + " " + emp.LastName,
                    EmployeeCode = emp.EmployeeCode,
                    Date = x.Date,
                    PunchIn = null,
                    PunchOut = null,
                    WorkedHours = null,
                    Status = "On Leave",
                    Remarks = null,
                    Source = "System",
                    ShiftName = null,
                    ShiftType = null,
                    ExpectedStart = null,
                    ExpectedEnd = null,
                    IsLate = false,
                    LateMins = 0,
                    IsEarlyDeparture = false,
                    EarlyDepartureMins = 0,
                    IsShortHours = false,
                    IsOnLeave = true,
                    Latitude = null,
                    Longitude = null,
                };
            })
            .ToList();
    }

    public async Task<AttendanceSummaryDto> GetSummaryAsync(DateTime from, DateTime to, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var query = BuildAttendanceQuery(from.Date, to.Date, employeeId, allowedEmployeeIds);

        var summary = new AttendanceSummaryDto
        {
            TotalPresent = await query.CountAsync(r => r.Status == "Present" || r.Status == "Late"),
            TotalAbsent = await query.CountAsync(r => r.Status == "Absent"),
            TotalLate = await query.CountAsync(r => r.Status == "Late"),
            TotalNoPunch = await query.CountAsync(r => r.PunchIn == null),
        };

        var hoursQuery = query.Where(r => r.WorkedHours.HasValue).Select(r => r.WorkedHours!.Value);
        summary.AverageWorkHours = await hoursQuery.AnyAsync()
            ? await hoursQuery.AverageAsync()
            : 0;

        return summary;
    }

    public async Task<IReadOnlyList<AttendanceDailySummaryDto>> GetDailySummariesAsync(
        DateTime from, DateTime to, Guid? employeeId = null, IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var fromDate = from.Date;
        var toDate = to.Date;
        var query = BuildAttendanceQuery(fromDate, toDate, employeeId, allowedEmployeeIds);

        var rows = await query
            .GroupBy(a => a.Date)
            .Select(g => new AttendanceDailySummaryDto
            {
                Date = g.Key,
                TotalPresent = g.Count(r => r.Status == "Present" || r.Status == "Late"),
                TotalAbsent = g.Count(r => r.Status == "Absent"),
                TotalLate = g.Count(r => r.Status == "Late"),
                TotalNoPunch = g.Count(r => r.PunchIn == null),
            })
            .OrderBy(x => x.Date)
            .ToListAsync();

        return rows;
    }

    private IQueryable<AttendanceRecord> BuildAttendanceQuery(
        DateTime from, DateTime to, Guid? employeeId, IReadOnlyList<Guid>? allowedEmployeeIds)
    {
        var fromDay = from.Date;
        var toExclusive = to.Date.AddDays(1);
        var query = _db.Set<AttendanceRecord>().AsNoTracking()
            .Where(a => a.Date >= fromDay && a.Date < toExclusive);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        return query;
    }

    public async Task<AttendanceRecordDto> CreateAsync(CreateAttendanceRecordDto dto)
    {
        decimal? workedHours = null;
        if (dto.PunchIn.HasValue && dto.PunchOut.HasValue)
            workedHours = Math.Round((decimal)(dto.PunchOut.Value - dto.PunchIn.Value).TotalHours, 2);

        var entity = new AttendanceRecord
        {
            EmployeeId = dto.EmployeeId,
            Date = dto.Date.Date,
            PunchIn = dto.PunchIn.HasValue ? AttendancePunchTimes.AsWallClock(dto.PunchIn.Value) : null,
            PunchOut = dto.PunchOut.HasValue ? AttendancePunchTimes.AsWallClock(dto.PunchOut.Value) : null,
            WorkedHours = workedHours,
            Status = dto.Status,
            Remarks = dto.Remarks,
            Source = dto.Source ?? "Web",
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
        };

        _db.Set<AttendanceRecord>().Add(entity);
        await _db.SaveChangesAsync();

        var full = await _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .FirstAsync(a => a.Id == entity.Id);
        var rosters = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => ra.EmployeeId == entity.EmployeeId)
            .ToListAsync();
        var onLeave = await HasApprovedLeaveOnDateAsync(entity.EmployeeId, entity.Date);
        return MapToDto(full, rosters, onLeave);
    }

    public async Task<AttendanceRecordDto?> UpdateAsync(Guid id, UpdateAttendanceRecordDto dto)
    {
        var entity = await _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (entity is null) return null;

        if (dto.Status != null) entity.Status = dto.Status;
        if (dto.Remarks != null) entity.Remarks = dto.Remarks;
        if (!string.IsNullOrWhiteSpace(dto.Source)) entity.Source = dto.Source.Trim();

        // Edit / Log Attendance send Asia/Colombo wall clock (no offset). Store as Unspecified
        // so MapToDto does not treat them as UTC device punches (+5:30 shift).
        if (dto.PunchIn.HasValue)
            entity.PunchIn = AttendancePunchTimes.AsWallClock(dto.PunchIn.Value);
        if (dto.PunchOut.HasValue)
            entity.PunchOut = AttendancePunchTimes.AsWallClock(dto.PunchOut.Value);

        if (entity.PunchIn.HasValue && entity.PunchOut.HasValue)
            entity.WorkedHours = Math.Round((decimal)(entity.PunchOut.Value - entity.PunchIn.Value).TotalHours, 2);

        await _db.SaveChangesAsync();

        var rosters = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => ra.EmployeeId == entity.EmployeeId)
            .ToListAsync();
        var onLeave = await HasApprovedLeaveOnDateAsync(entity.EmployeeId, entity.Date);
        return MapToDto(entity, rosters, onLeave);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _db.Set<AttendanceRecord>().FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<AttendanceRecordDto> PunchAsync(Guid employeeId, PunchRequestDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.QrPayload))
        {
            var employee = await _db.Employees.AsNoTracking()
                .FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted)
                ?? throw new InvalidOperationException("Employee not found.");
            AttendancePunchPolicyEvaluator.ValidateEmployeeMatchesScannedQr(employee, dto);
        }

        var punchPolicy = await AttendancePunchPolicyEvaluator.EvaluateAsync(_db, _settings, employeeId, dto);

        var nowUtc = DateTime.UtcNow;
        var now = DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc);
        var today = _clock.ToBusinessLocal(nowUtc).Date;
        var onLeaveToday = await HasApprovedLeaveOnDateAsync(employeeId, today);
        var isOut = dto.Type.Equals("out", StringComparison.OrdinalIgnoreCase);
        var source = string.IsNullOrWhiteSpace(dto.Source) ? "Mobile" : dto.Source.Trim();

        var dayRows = await _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.EmployeeId == employeeId && a.Date == today && !a.IsDeleted)
            .OrderBy(a => a.PunchIn ?? DateTime.MaxValue)
            .ThenBy(a => a.CreatedAt)
            .ToListAsync();

        if (dayRows.Count == 0 && isOut)
            throw new InvalidOperationException("There is no open check-in to check out from.");

        var record = MergeDayRecords(dayRows, employeeId, today, source);
        if (record.Employee == null)
        {
            await _db.Entry(record).Reference(a => a.Employee).LoadAsync();
            if (record.Employee != null)
                await _db.Entry(record.Employee).Reference(e => e.ShiftPattern).LoadAsync();
        }

        if (isOut)
        {
            if (!record.PunchIn.HasValue)
                throw new InvalidOperationException("There is no open check-in to check out from.");

            if (!record.PunchOut.HasValue || now > record.PunchOut.Value)
                record.PunchOut = now;
            ApplyFiloWorkedHours(record);
        }
        else
        {
            if (!record.PunchIn.HasValue || now < record.PunchIn.Value)
                record.PunchIn = now;
            // Currently in: keep first punch-in; last out is applied on the next punch-out.
            record.PunchOut = null;
            record.WorkedHours = null;
            record.Status = "Present";
        }

        if (dto.Latitude.HasValue) record.Latitude = dto.Latitude;
        if (dto.Longitude.HasValue) record.Longitude = dto.Longitude;
        if (punchPolicy.ResolvedPlace != null) record.AttendancePlaceId = punchPolicy.ResolvedPlace.Id;
        if (string.IsNullOrWhiteSpace(record.Source) || record.Source == "Mobile")
            record.Source = source;

        await ApplyAttendancePunchMetaAsync(record, dto, source);
        await _db.SaveChangesAsync();

        var full = await _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .FirstAsync(a => a.Id == record.Id);
        var rosters = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => ra.EmployeeId == employeeId).ToListAsync();
        return MapToDto(full, rosters, onLeaveToday);
    }

    private AttendanceRecord MergeDayRecords(
        List<AttendanceRecord> dayRows,
        Guid employeeId,
        DateTime today,
        string source)
    {
        if (dayRows.Count == 0)
        {
            var created = new AttendanceRecord
            {
                EmployeeId = employeeId,
                Date = today,
                Status = "Present",
                Source = source,
            };
            _db.Set<AttendanceRecord>().Add(created);
            return created;
        }

        var keep = dayRows[0];
        foreach (var extra in dayRows.Skip(1))
        {
            if (extra.PunchIn.HasValue && (!keep.PunchIn.HasValue || extra.PunchIn < keep.PunchIn))
                keep.PunchIn = extra.PunchIn;
            if (extra.PunchOut.HasValue && (!keep.PunchOut.HasValue || extra.PunchOut > keep.PunchOut))
                keep.PunchOut = extra.PunchOut;
            extra.IsDeleted = true;
        }

        ApplyFiloWorkedHours(keep);
        keep.Status = "Present";
        return keep;
    }

    private static void ApplyFiloWorkedHours(AttendanceRecord record)
    {
        if (record.PunchIn.HasValue && record.PunchOut.HasValue && record.PunchOut.Value > record.PunchIn.Value)
            record.WorkedHours = Math.Round((decimal)(record.PunchOut.Value - record.PunchIn.Value).TotalHours, 2);
        else
            record.WorkedHours = null;
    }

    private static List<AttendanceRecordDto> CollapseToFirstInLastOut(List<AttendanceRecordDto> items)
    {
        if (items.Count <= 1)
            return items;

        return items
            .GroupBy(x => (x.EmployeeId, x.Date.Date))
            .Select(g =>
            {
                var rows = g.OrderBy(x => x.PunchIn ?? DateTime.MaxValue).ThenBy(x => x.Id).ToList();
                var keep = rows[0];
                DateTime? firstIn = null;
                DateTime? lastOut = null;
                foreach (var row in rows)
                {
                    if (row.PunchIn.HasValue && (!firstIn.HasValue || row.PunchIn < firstIn))
                        firstIn = row.PunchIn;
                    if (row.PunchOut.HasValue && (!lastOut.HasValue || row.PunchOut > lastOut))
                        lastOut = row.PunchOut;
                    if (!string.IsNullOrWhiteSpace(row.Source) && string.IsNullOrWhiteSpace(keep.Source))
                        keep.Source = row.Source;
                }

                keep.PunchIn = firstIn;
                keep.PunchOut = lastOut;
                if (firstIn.HasValue && lastOut.HasValue && lastOut.Value > firstIn.Value)
                    keep.WorkedHours = Math.Round((decimal)(lastOut.Value - firstIn.Value).TotalHours, 2);
                else
                    keep.WorkedHours = null;
                return keep;
            })
            .ToList();
    }

    private async Task ApplyAttendancePunchMetaAsync(AttendanceRecord record, PunchRequestDto dto, string source)
    {
        var hasBu = dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty;
        var hasLocation = dto.LocationId.HasValue && dto.LocationId != Guid.Empty;
        if (!hasBu && !hasLocation)
            return;

        var label = string.IsNullOrWhiteSpace(dto.Source) || source.Equals("Mobile", StringComparison.OrdinalIgnoreCase)
            ? "Mobile QR"
            : source;
        record.Source = label;

        if (hasBu)
        {
            var bu = await _db.Set<BusinessUnit>().AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == dto.BusinessUnitId!.Value && !b.IsDeleted);
            AppendRemark(record, bu is null
                ? $"BU:{dto.BusinessUnitId:D}"
                : $"BU:{bu.Code} ({bu.Name})");
        }

        if (hasLocation)
        {
            var location = await _db.Set<Location>().AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == dto.LocationId!.Value && !l.IsDeleted);
            AppendRemark(record, location is null
                ? $"LOC:{dto.LocationId:D}"
                : $"LOC:{location.Code} ({location.Name})");
        }
    }

    private static void AppendRemark(AttendanceRecord record, string remark)
    {
        if (string.IsNullOrWhiteSpace(record.Remarks) || !record.Remarks.Contains(remark, StringComparison.OrdinalIgnoreCase))
        {
            record.Remarks = string.IsNullOrWhiteSpace(record.Remarks)
                ? remark
                : $"{record.Remarks} | {remark}";
        }
    }

    public async Task<List<OvertimeNopayResultDto>> CalculateOvertimeNopayAsync(
        DateTime from, DateTime to, Guid? employeeId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        IReadOnlyList<Guid>? includeEmployeeIds = null,
        Guid? actingEmployeeId = null,
        bool hrCanOverride = false)
    {
        var attendanceQuery = _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.Date >= from.Date && a.Date < to.Date.AddDays(1));

        if (employeeId.HasValue)
            attendanceQuery = attendanceQuery.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            attendanceQuery = attendanceQuery.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var records = await attendanceQuery.ToListAsync();

        var employeesQuery = _db.Employees
            .Include(e => e.ShiftPattern)
            .Include(e => e.Department)
            .Where(e => e.Status != "Terminated");

        if (employeeId.HasValue)
            employeesQuery = employeesQuery.Where(e => e.Id == employeeId.Value);
        else if (includeEmployeeIds != null)
            employeesQuery = employeesQuery.Where(e => includeEmployeeIds.Contains(e.Id));
        else if (allowedEmployeeIds != null)
            employeesQuery = employeesQuery.Where(e => allowedEmployeeIds.Contains(e.Id));

        var employees = await employeesQuery.ToListAsync();
        if (employees.Count == 0)
            return [];

        var empIds = employees.Select(e => e.Id).ToList();

        var rosterAssignments = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => empIds.Contains(ra.EmployeeId))
            .ToListAsync();

        var onLeaveSet = await GetApprovedLeaveDatesAsync(empIds, from.Date, to.Date);
        var recordsByEmployee = records.GroupBy(r => r.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

        var results = new List<OvertimeNopayResultDto>();
        foreach (var emp in employees)
        {
            var empRosters = rosterAssignments.Where(ra => ra.EmployeeId == emp.Id).ToList();
            recordsByEmployee.TryGetValue(emp.Id, out var empRecords);
            empRecords ??= [];

            decimal totalWorked = 0;
            decimal expectedHours = 0;
            decimal preOtTotal = 0;
            decimal postOtTotal = 0;
            int lateDays = 0, presentDays = 0, absentDays = 0;

            var recordsByDate = empRecords.GroupBy(r => r.Date.Date).ToDictionary(g => g.Key, g => g.ToList());

            for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
            {
                var isOnLeave = onLeaveSet.Contains((emp.Id, d));
                if (isOnLeave)
                    continue;

                var (_, _, hoursPerDay) = GetExpectedShift(emp, empRosters, d);
                expectedHours += hoursPerDay;

                if (recordsByDate.TryGetValue(d, out var dayRecords)
                    && dayRecords.Any(r => ShiftAttendanceCalculator.CountsAsPresent(r.Status, r.PunchIn)))
                {
                    var presentRecords = dayRecords
                        .Where(r => ShiftAttendanceCalculator.CountsAsPresent(r.Status, r.PunchIn))
                        .ToList();

                    DateTime? earliestIn = null;
                    DateTime? latestOut = null;
                    foreach (var record in presentRecords)
                    {
                        var punchIn = AttendancePunchTimes.ToApiWallClock(record.PunchIn, record.Source, _clock);
                        var punchOut = AttendancePunchTimes.ToApiWallClock(record.PunchOut, record.Source, _clock);
                        if (punchIn.HasValue && (!earliestIn.HasValue || punchIn.Value < earliestIn.Value))
                            earliestIn = punchIn;
                        if (punchOut.HasValue && (!latestOut.HasValue || punchOut.Value > latestOut.Value))
                            latestOut = punchOut;
                    }

                    var dayWorked = ShiftAttendanceCalculator.ResolveWorkedHours(null, earliestIn, latestOut);

                    totalWorked += dayWorked;
                    presentDays++;
                    if (presentRecords.Any(r => string.Equals(r.Status, "Late", StringComparison.OrdinalIgnoreCase)))
                        lateDays++;

                    var shift = ResolveShiftPattern(emp, empRosters, d);
                    var prePost = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, d, earliestIn, latestOut);
                    preOtTotal += prePost.PreOtHours;
                    postOtTotal += prePost.PostOtHours;
                }
                else if (hoursPerDay > 0)
                {
                    absentDays++;
                }
            }

            var nopayHours = Math.Max(0, expectedHours - totalWorked);
            var otHours = Math.Round(preOtTotal + postOtTotal, 2);

            results.Add(new OvertimeNopayResultDto
            {
                EmployeeId = emp.Id,
                EmployeeName = emp.FirstName + " " + emp.LastName,
                EmployeeCode = emp.EmployeeCode,
                DepartmentName = emp.Department?.Name,
                TotalWorkedHours = Math.Round(totalWorked, 2),
                ExpectedHours = Math.Round(expectedHours, 2),
                OvertimeHours = otHours,
                PreOtHours = Math.Round(preOtTotal, 2),
                PostOtHours = Math.Round(postOtTotal, 2),
                NopayDays = absentDays,
                NopayHours = Math.Round(nopayHours, 2),
                LateDays = lateDays,
                PresentDays = presentDays,
                AbsentDays = absentDays,
            });
        }

        var ordered = results.OrderBy(r => r.EmployeeName).ToList();
        await EnrichOtApprovalAndSupervisorAsync(ordered, from.Date, to.Date, actingEmployeeId, hrCanOverride);
        return ordered;
    }

    public async Task<List<OvertimeNopayDayDto>> GetOvertimeNopayDaysAsync(
        DateTime from, DateTime to, Guid? employeeId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var attendanceQuery = _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.Date >= from.Date && a.Date < to.Date.AddDays(1));

        if (employeeId.HasValue)
            attendanceQuery = attendanceQuery.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            attendanceQuery = attendanceQuery.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var records = await attendanceQuery.ToListAsync();

        var employeesQuery = _db.Employees
            .Include(e => e.ShiftPattern)
            .Include(e => e.Department)
            .Where(e => e.Status != "Terminated");

        if (employeeId.HasValue)
            employeesQuery = employeesQuery.Where(e => e.Id == employeeId.Value);
        else if (allowedEmployeeIds != null)
            employeesQuery = employeesQuery.Where(e => allowedEmployeeIds.Contains(e.Id));

        var employees = await employeesQuery.ToListAsync();
        if (employees.Count == 0)
            return [];

        var empIds = employees.Select(e => e.Id).ToList();
        var rosterAssignments = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => empIds.Contains(ra.EmployeeId))
            .ToListAsync();

        var onLeaveSet = await GetApprovedLeaveDatesAsync(empIds, from.Date, to.Date);
        var recordsByEmployee = records.GroupBy(r => r.EmployeeId).ToDictionary(g => g.Key, g => g.ToList());

        var days = new List<OvertimeNopayDayDto>();
        foreach (var emp in employees)
        {
            var empRosters = rosterAssignments.Where(ra => ra.EmployeeId == emp.Id).ToList();
            recordsByEmployee.TryGetValue(emp.Id, out var empRecords);
            empRecords ??= [];
            var recordsByDate = empRecords.GroupBy(r => r.Date.Date).ToDictionary(g => g.Key, g => g.ToList());

            for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
            {
                if (onLeaveSet.Contains((emp.Id, d)))
                    continue;

                if (!recordsByDate.TryGetValue(d, out var dayRecords)
                    || !dayRecords.Any(r => ShiftAttendanceCalculator.CountsAsPresent(r.Status, r.PunchIn)))
                    continue;

                var presentRecords = dayRecords
                    .Where(r => ShiftAttendanceCalculator.CountsAsPresent(r.Status, r.PunchIn))
                    .ToList();

                DateTime? earliestIn = null;
                DateTime? latestOut = null;
                foreach (var record in presentRecords)
                {
                    var punchIn = AttendancePunchTimes.ToApiWallClock(record.PunchIn, record.Source, _clock);
                    var punchOut = AttendancePunchTimes.ToApiWallClock(record.PunchOut, record.Source, _clock);
                    if (punchIn.HasValue && (!earliestIn.HasValue || punchIn.Value < earliestIn.Value))
                        earliestIn = punchIn;
                    if (punchOut.HasValue && (!latestOut.HasValue || punchOut.Value > latestOut.Value))
                        latestOut = punchOut;
                }

                var dayWorked = ShiftAttendanceCalculator.ResolveWorkedHours(null, earliestIn, latestOut);

                var shift = ResolveShiftPattern(emp, empRosters, d);
                var prePost = ShiftAttendanceCalculator.ComputePrePostOtHours(shift, d, earliestIn, latestOut);
                if (prePost.PreOtHours <= 0 && prePost.PostOtHours <= 0)
                    continue;

                var (_, _, hoursPerDay) = GetExpectedShift(emp, empRosters, d);
                days.Add(new OvertimeNopayDayDto
                {
                    EmployeeId = emp.Id,
                    EmployeeName = emp.FirstName + " " + emp.LastName,
                    EmployeeCode = emp.EmployeeCode,
                    DepartmentName = emp.Department?.Name,
                    Date = d,
                    PunchIn = earliestIn,
                    PunchOut = latestOut,
                    ShiftName = shift?.Name,
                    ExpectedHours = Math.Round(hoursPerDay, 2),
                    WorkedHours = Math.Round(dayWorked, 2),
                    PreOtHours = Math.Round(prePost.PreOtHours, 2),
                    PostOtHours = Math.Round(prePost.PostOtHours, 2),
                    OvertimeHours = Math.Round(prePost.PreOtHours + prePost.PostOtHours, 2),
                });
            }
        }

        return days
            .OrderBy(r => r.EmployeeName)
            .ThenBy(r => r.Date)
            .ToList();
    }

    private async Task EnrichOtApprovalAndSupervisorAsync(
        List<OvertimeNopayResultDto> results, DateTime periodFrom, DateTime periodTo, Guid? actingEmployeeId,
        bool hrCanOverride = false)
    {
        if (results.Count == 0) return;

        var ids = results.Select(r => r.EmployeeId).ToList();
        var approvals = await _db.Set<OvertimeNopayPeriodApproval>()
            .AsNoTracking()
            .Include(a => a.Approver)
            .Where(a => !a.IsDeleted && a.PeriodFrom == periodFrom && a.PeriodTo == periodTo && ids.Contains(a.EmployeeId))
            .ToListAsync();

        var supervisors = await _db.Set<EmployeeSupervisor>()
            .AsNoTracking()
            .Include(s => s.Supervisor)
            .Where(s => !s.IsDeleted && ids.Contains(s.EmployeeId))
            .ToListAsync();

        var supervisorByEmployee = supervisors
            .GroupBy(s => s.EmployeeId)
            .ToDictionary(
                g => g.Key,
                g => g
                    .OrderByDescending(s => string.Equals(s.ReportingMethod, "Direct", StringComparison.OrdinalIgnoreCase))
                    .ThenByDescending(s => string.Equals(s.ReportingMethod, "Both", StringComparison.OrdinalIgnoreCase))
                    .First());

        var reportingGraph = await ReportingChain.LoadAsync(_db);

        foreach (var r in results)
        {
            var ap = approvals.FirstOrDefault(a => a.EmployeeId == r.EmployeeId);
            if (ap != null)
            {
                r.OvertimeApprovalStatus = ap.Status.ToString();
                r.OvertimeApprovedAt = ap.ActionAt;
                r.OvertimeApproverName = ap.Approver != null ? ap.Approver.FirstName + " " + ap.Approver.LastName : null;
                r.ApprovedOvertimeHoursSnapshot = ap.OvertimeHoursSnapshot;
                r.OvertimeHoursOutdated = ap.Status == ApprovalStatus.Approved
                    && Math.Abs(ap.OvertimeHoursSnapshot - r.OvertimeHours) > 0.02m;
                r.Remarks = ap.Remarks;
            }

            if (supervisorByEmployee.TryGetValue(r.EmployeeId, out var link) && link.Supervisor != null)
            {
                r.HasSupervisor = true;
                r.SupervisorId = link.SupervisorId;
                r.SupervisorName = (link.Supervisor.FirstName + " " + link.Supervisor.LastName).Trim();
            }
            else if (reportingGraph.PrimarySupervisorByEmployee.TryGetValue(r.EmployeeId, out var managerId))
            {
                r.HasSupervisor = true;
                r.SupervisorId = managerId;
            }

            r.OtStatus = ResolveOtStatus(r);
            r.OtStatusLabel = OtStatusLabel(r.OtStatus, r.OvertimeHoursOutdated);
            r.CanApprove = CanActingEmployeeApproveOt(r, actingEmployeeId, reportingGraph, hrCanOverride);
        }
    }

    internal static bool HasOtHours(OvertimeNopayResultDto row)
        => row.OvertimeHours > 0 || row.PreOtHours > 0 || row.PostOtHours > 0;

    internal static string ResolveOtStatus(OvertimeNopayResultDto row)
    {
        if (!HasOtHours(row))
            return "NoOt";

        var approval = row.OvertimeApprovalStatus ?? "";
        if (string.Equals(approval, nameof(ApprovalStatus.Approved), StringComparison.OrdinalIgnoreCase))
            return "Approved";
        if (string.Equals(approval, nameof(ApprovalStatus.Rejected), StringComparison.OrdinalIgnoreCase))
            return "Rejected";
        if (!row.HasSupervisor)
            return "SupervisorNotAssigned";
        return "PendingApproval";
    }

    internal static string OtStatusLabel(string status, bool outdated)
    {
        return status switch
        {
            "Approved" => outdated ? "Approved (outdated)" : "Approved",
            "Rejected" => "Rejected",
            "SupervisorNotAssigned" => "Supervisor Not Assigned",
            "PendingApproval" => "Pending Approval",
            _ => "No OT",
        };
    }

    internal static bool CanActingEmployeeApproveOt(
        OvertimeNopayResultDto row,
        Guid? actingEmployeeId,
        ReportingGraph reportingGraph,
        bool hrCanOverride = false)
    {
        if (!HasOtHours(row))
            return false;
        if (actingEmployeeId.HasValue && row.EmployeeId == actingEmployeeId.Value)
            return false;

        var status = row.OtStatus;
        var actionable = status is "PendingApproval" or "Rejected"
            || (status == "Approved" && row.OvertimeHoursOutdated)
            || (hrCanOverride && status == "SupervisorNotAssigned");
        if (!actionable)
            return false;

        if (hrCanOverride)
            return true;
        if (!actingEmployeeId.HasValue || !row.HasSupervisor)
            return false;
        return ReportingChain.IsInSupervisorChain(reportingGraph, row.EmployeeId, actingEmployeeId.Value);
    }

    public async Task<OvertimeNopayResultDto?> SetOvertimeNopayPeriodApprovalAsync(
        DateTime from,
        DateTime to,
        Guid employeeId,
        Guid? approverEmployeeId,
        bool approve,
        string? remarks,
        IReadOnlyList<Guid>? allowedEmployeeIds = null,
        bool hrCanOverride = false)
    {
        if (allowedEmployeeIds != null && !allowedEmployeeIds.Contains(employeeId))
            return null;

        if (!approve && string.IsNullOrWhiteSpace(remarks))
            throw new InvalidOperationException("A reason is required to reject overtime.");

        var periodFrom = from.Date;
        var periodTo = to.Date;

        var rows = await CalculateOvertimeNopayAsync(
            from, to, employeeId, allowedEmployeeIds, actingEmployeeId: approverEmployeeId, hrCanOverride: hrCanOverride);
        var row = rows.FirstOrDefault();
        if (row == null) return null;

        if (!HasOtHours(row))
            throw new InvalidOperationException("There is no overtime to approve for this period.");
        if (approverEmployeeId.HasValue && employeeId == approverEmployeeId.Value)
            throw new InvalidOperationException("You cannot approve or reject your own overtime.");

        var reportingGraph = await ReportingChain.LoadAsync(_db);
        if (!CanActingEmployeeApproveOt(row, approverEmployeeId, reportingGraph, hrCanOverride))
        {
            if (!row.HasSupervisor && !hrCanOverride)
                throw new InvalidOperationException("Supervisor not assigned. Overtime cannot be approved until a supervisor is assigned.");
            throw new InvalidOperationException(
                "Only the employee's supervisor, a higher-level supervisor, or HR can approve or reject overtime.");
        }

        var existing = await _db.Set<OvertimeNopayPeriodApproval>()
            .FirstOrDefaultAsync(a => !a.IsDeleted && a.EmployeeId == employeeId && a.PeriodFrom == periodFrom && a.PeriodTo == periodTo);

        if (existing == null)
        {
            existing = new OvertimeNopayPeriodApproval
            {
                EmployeeId = employeeId,
                PeriodFrom = periodFrom,
                PeriodTo = periodTo,
            };
            _db.Set<OvertimeNopayPeriodApproval>().Add(existing);
        }

        existing.Status = approve ? ApprovalStatus.Approved : ApprovalStatus.Rejected;
        existing.ApproverId = approverEmployeeId;
        existing.ActionAt = DateTime.UtcNow;
        existing.Remarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim();
        existing.OvertimeHoursSnapshot = row.OvertimeHours;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        var refreshed = await CalculateOvertimeNopayAsync(
            from, to, employeeId, allowedEmployeeIds, actingEmployeeId: approverEmployeeId, hrCanOverride: hrCanOverride);
        return refreshed.FirstOrDefault();
    }

    /// <summary>
    /// Returns the set of (EmployeeId, Date) that fall within approved leave in the given range.
    /// </summary>
    private async Task<HashSet<(Guid EmployeeId, DateTime Date)>> GetApprovedLeaveDatesAsync(
        List<Guid> employeeIds, DateTime fromDate, DateTime toDate)
    {
        if (employeeIds.Count == 0) return new HashSet<(Guid, DateTime)>();

        var leaves = await _db.Set<LeaveRequest>()
            .Where(lr => lr.Status == ApprovalStatus.Approved
                && employeeIds.Contains(lr.EmployeeId)
                && lr.StartDate.Date <= toDate
                && lr.EndDate.Date >= fromDate)
            .Select(lr => new { lr.EmployeeId, lr.StartDate, lr.EndDate })
            .ToListAsync();

        var set = new HashSet<(Guid, DateTime)>();
        foreach (var l in leaves)
        {
            for (var d = l.StartDate.Date; d <= l.EndDate.Date; d = d.AddDays(1))
            {
                if (d >= fromDate && d <= toDate)
                    set.Add((l.EmployeeId, d));
            }
        }
        return set;
    }

    private async Task<bool> HasApprovedLeaveOnDateAsync(Guid employeeId, DateTime date)
    {
        return await _db.Set<LeaveRequest>()
            .AnyAsync(lr => lr.EmployeeId == employeeId
                && lr.Status == ApprovalStatus.Approved
                && lr.StartDate.Date <= date
                && lr.EndDate.Date >= date);
    }

    private AttendanceRecordDto MapToDto(AttendanceRecord a, List<RosterAssignment> rosterAssignments, bool isOnLeave = false)
    {
        var punchIn = AttendancePunchTimes.ToApiWallClock(a.PunchIn, a.Source, _clock);
        var punchOut = AttendancePunchTimes.ToApiWallClock(a.PunchOut, a.Source, _clock);
        var shift = ResolveShiftPattern(a.Employee, rosterAssignments, a.Date);

        bool isLate = false;
        int lateMins = 0;
        bool isEarlyDeparture = false;
        int earlyDepartureMins = 0;
        bool isShortHours = false;
        TimeSpan? expectedStart = null;
        TimeSpan? expectedEnd = null;
        string? shiftName = null;
        string? shiftType = null;

        if (isOnLeave)
        {
            shiftName = shift?.Name;
            shiftType = shift?.ShiftType;
            // No expected times, no late/early/short flags when on leave
        }
        else if (shift != null)
        {
            shiftName = shift.Name;
            shiftType = shift.ShiftType;

            switch (shift.ShiftType)
            {
                case "Flexi":
                    expectedStart = shift.FlexiWindowStart;
                    expectedEnd = shift.FlexiWindowEnd;
                    if (a.WorkedHours.HasValue && shift.MinimumWorkHours.HasValue && a.WorkedHours.Value < shift.MinimumWorkHours.Value)
                        isShortHours = true;
                    break;

                case "Open":
                    break;

                case "Split":
                    expectedStart = shift.StartTime;
                    expectedEnd = shift.Session2EndTime ?? shift.EndTime;
                    if (punchIn.HasValue)
                    {
                        var s1Start = a.Date.Date + shift.StartTime;
                        if (punchIn.Value > s1Start.AddMinutes(shift.LateGraceMinutes))
                        {
                            isLate = true;
                            lateMins = (int)(punchIn.Value - s1Start).TotalMinutes;
                        }
                    }
                    if (punchOut.HasValue && shift.Session2EndTime.HasValue)
                    {
                        var s2End = ShiftAttendanceCalculator.ResolveSession2EndDateTime(shift, a.Date);
                        if (punchOut.Value < s2End.AddMinutes(-shift.EarlyDepartureGraceMinutes))
                        {
                            isEarlyDeparture = true;
                            earlyDepartureMins = (int)(s2End - punchOut.Value).TotalMinutes;
                        }
                    }
                    break;

                default: // Regular, Rotational
                    expectedStart = shift.StartTime;
                    expectedEnd = shift.EndTime;
                    if (punchIn.HasValue)
                    {
                        var expStart = a.Date.Date + shift.StartTime;
                        if (punchIn.Value > expStart.AddMinutes(shift.LateGraceMinutes))
                        {
                            isLate = true;
                            lateMins = (int)(punchIn.Value - expStart).TotalMinutes;
                        }
                    }
                    if (punchOut.HasValue)
                    {
                        var expEnd = a.Date.Date + shift.EndTime;
                        if (shift.IsNightShift && shift.EndTime < shift.StartTime)
                            expEnd = expEnd.AddDays(1);
                        if (punchOut.Value < expEnd.AddMinutes(-shift.EarlyDepartureGraceMinutes))
                        {
                            isEarlyDeparture = true;
                            earlyDepartureMins = (int)(expEnd - punchOut.Value).TotalMinutes;
                        }
                    }
                    break;
            }
        }

        return new AttendanceRecordDto
        {
            Id = a.Id,
            EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
            EmployeeCode = a.Employee.EmployeeCode,
            EmployeeId = a.EmployeeId,
            Date = AttendancePunchTimes.AsWallClock(a.Date.Date),
            PunchIn = punchIn,
            PunchOut = punchOut,
            WorkedHours = a.WorkedHours,
            Status = isOnLeave ? "On Leave" : a.Status,
            Remarks = a.Remarks,
            Source = a.Source,
            ShiftName = shiftName,
            ShiftType = shiftType,
            ExpectedStart = expectedStart,
            ExpectedEnd = expectedEnd,
            IsLate = isLate,
            LateMins = lateMins,
            IsEarlyDeparture = isEarlyDeparture,
            EarlyDepartureMins = earlyDepartureMins,
            IsShortHours = isShortHours,
            IsOnLeave = isOnLeave,
            Latitude = a.Latitude,
            Longitude = a.Longitude,
        };
    }

    private ShiftPattern? ResolveShiftPattern(Employee emp, List<RosterAssignment> rosters, DateTime date) =>
        ShiftAttendanceCalculator.ResolveShiftPattern(emp, rosters, date);

    private (TimeSpan? start, TimeSpan? end, decimal hoursPerDay) GetExpectedShift(Employee emp, List<RosterAssignment> rosters, DateTime date)
    {
        var roster = rosters
            .Where(ra => ra.EmployeeId == emp.Id && ra.EffectiveFrom <= date && (ra.EffectiveTo == null || ra.EffectiveTo >= date))
            .OrderByDescending(ra => ra.EffectiveFrom)
            .FirstOrDefault();

        if (roster?.RosterTemplate != null)
        {
            var start = roster.RosterTemplate.DefaultStartTime;
            var end = roster.RosterTemplate.DefaultEndTime;
            var fullHours = roster.RosterTemplate.WorkHoursPerDay;
            var shift = roster.RosterTemplate.DefaultShiftPattern;
            if (shift != null)
            {
                var (applies, dayStart, dayEnd, hours) = GetShiftTimesForDate(shift, date, start, end, fullHours);
                if (!applies)
                    return (start, end, 0);
                return (dayStart ?? start, dayEnd ?? end, hours);
            }
            return (start, end, fullHours);
        }

        if (emp.ShiftPattern != null)
        {
            var shift = emp.ShiftPattern;
            var (applies, dayStart, dayEnd, hours) = GetShiftTimesForDate(shift, date, shift.StartTime, shift.EndTime, null);
            if (!applies)
                return (shift.StartTime, shift.EndTime, 0);
            return (dayStart ?? shift.StartTime, dayEnd ?? shift.EndTime, hours);
        }

        var defaultHours = date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday ? 0m : 8m;
        return (null, null, defaultHours);
    }

    private static (bool applies, TimeSpan? start, TimeSpan? end, decimal hours) GetShiftTimesForDate(
        ShiftPattern shift, DateTime date, TimeSpan defaultStart, TimeSpan defaultEnd, decimal? defaultHours) =>
        ShiftAttendanceCalculator.GetShiftTimesForDate(shift, date, defaultStart, defaultEnd, defaultHours);
}
