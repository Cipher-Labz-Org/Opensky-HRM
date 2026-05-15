using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AttendanceService : IAttendanceService
{
    private readonly AppDbContext _db;

    public AttendanceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<AttendanceRecordDto>> GetAttendanceAsync(
        int page = 1, int pageSize = 20, Guid? employeeId = null,
        DateTime? fromDate = null, DateTime? toDate = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var today = DateTime.Now.Date;
        var from = fromDate?.Date ?? new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = toDate?.Date ?? today;
        if (to < from) to = from;

        var query = _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.Date >= from && a.Date <= to);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var rawItems = await query
            .OrderByDescending(a => a.Date).ThenBy(a => a.Employee.FirstName)
            .ToListAsync();

        var recordsSet = rawItems.Select(a => (a.EmployeeId, a.Date)).ToHashSet();
        var employeeIdsFromRecords = rawItems.Select(r => r.EmployeeId).Distinct().ToList();

        var rosterAssignments = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => employeeIdsFromRecords.Contains(ra.EmployeeId))
            .ToListAsync();

        var onLeaveSet = await GetApprovedLeaveDatesAsync(employeeIdsFromRecords, from, to);

        var realDtos = rawItems.Select(a => MapToDto(a, rosterAssignments, onLeaveSet.Contains((a.EmployeeId, a.Date)))).ToList();

        var leaveOnlySet = await GetLeaveOnlyDatesAsync(from, to, employeeId, allowedEmployeeIds, recordsSet);
        var syntheticDtos = await BuildLeaveOnlyDtosAsync(leaveOnlySet);

        var combined = realDtos.Concat(syntheticDtos)
            .OrderByDescending(x => x.Date)
            .ThenBy(x => x.EmployeeName)
            .ToList();

        var total = combined.Count;
        var items = combined
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PagedResult<AttendanceRecordDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    /// <summary>
    /// Returns (EmployeeId, Date) pairs that have approved leave in range and no attendance record.
    /// </summary>
    private async Task<HashSet<(Guid EmployeeId, DateTime Date)>> GetLeaveOnlyDatesAsync(
        DateTime from, DateTime to, Guid? employeeId, IReadOnlyList<Guid>? allowedEmployeeIds,
        HashSet<(Guid EmployeeId, DateTime Date)> recordsSet)
    {
        var leaveQuery = _db.Set<LeaveRequest>()
            .Where(lr => lr.Status == ApprovalStatus.Approved
                && lr.StartDate.Date <= to
                && lr.EndDate.Date >= from);

        if (employeeId.HasValue)
            leaveQuery = leaveQuery.Where(lr => lr.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            leaveQuery = leaveQuery.Where(lr => allowedEmployeeIds.Contains(lr.EmployeeId));

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
        var query = _db.Set<AttendanceRecord>()
            .Where(a => a.Date >= from && a.Date <= to);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            query = query.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var records = await query.ToListAsync();

        return new AttendanceSummaryDto
        {
            TotalPresent = records.Count(r => r.Status == "Present" || r.Status == "Late"),
            TotalAbsent = records.Count(r => r.Status == "Absent"),
            TotalLate = records.Count(r => r.Status == "Late"),
            TotalNoPunch = records.Count(r => r.PunchIn == null),
            AverageWorkHours = records.Where(r => r.WorkedHours.HasValue).Select(r => r.WorkedHours!.Value).DefaultIfEmpty(0).Average(),
        };
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
            PunchIn = dto.PunchIn,
            PunchOut = dto.PunchOut,
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

        if (dto.PunchIn.HasValue) entity.PunchIn = dto.PunchIn;
        if (dto.PunchOut.HasValue) entity.PunchOut = dto.PunchOut;
        if (dto.Status != null) entity.Status = dto.Status;
        if (dto.Remarks != null) entity.Remarks = dto.Remarks;

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
        var now = DateTime.Now;
        var today = now.Date;
        var onLeaveToday = await HasApprovedLeaveOnDateAsync(employeeId, today);
        var isOut = dto.Type.Equals("out", StringComparison.OrdinalIgnoreCase);
        var source = string.IsNullOrWhiteSpace(dto.Source) ? "Mobile" : dto.Source.Trim();

        if (isOut)
        {
            var existing = await _db.Set<AttendanceRecord>()
                .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
                .Where(a => a.EmployeeId == employeeId && a.Date == today && a.PunchOut == null && !a.IsDeleted)
                .OrderByDescending(a => a.PunchIn ?? DateTime.MinValue)
                .FirstOrDefaultAsync();

            if (existing != null)
            {
                existing.PunchOut = now;
                existing.WorkedHours = Math.Round((decimal)(now - (existing.PunchIn ?? now)).TotalHours, 2);
                if (dto.Latitude.HasValue) existing.Latitude = dto.Latitude;
                if (dto.Longitude.HasValue) existing.Longitude = dto.Longitude;
                await _db.SaveChangesAsync();
                var rosters = await _db.Set<RosterAssignment>()
                    .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
                    .Where(ra => ra.EmployeeId == employeeId).ToListAsync();
                return MapToDto(existing, rosters, onLeaveToday);
            }

            throw new InvalidOperationException("There is no open check-in to check out from.");
        }

        var hasOpen = await _db.Set<AttendanceRecord>()
            .AnyAsync(a => a.EmployeeId == employeeId && a.Date == today && a.PunchOut == null && !a.IsDeleted);
        if (hasOpen)
            throw new InvalidOperationException("Check out before recording another check-in.");

        var newRecord = new AttendanceRecord
        {
            EmployeeId = employeeId,
            Date = today,
            PunchIn = now,
            PunchOut = null,
            Status = "Present",
            Source = source,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
        };
        _db.Set<AttendanceRecord>().Add(newRecord);
        await _db.SaveChangesAsync();

        var full = await _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .FirstAsync(a => a.Id == newRecord.Id);
        var allRosters = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => ra.EmployeeId == employeeId).ToListAsync();
        return MapToDto(full, allRosters, onLeaveToday);
    }

    public async Task<List<OvertimeNopayResultDto>> CalculateOvertimeNopayAsync(
        DateTime from, DateTime to, Guid? employeeId = null,
        IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        var attendanceQuery = _db.Set<AttendanceRecord>()
            .Include(a => a.Employee).ThenInclude(e => e.ShiftPattern)
            .Where(a => a.Date >= from.Date && a.Date <= to.Date);

        if (employeeId.HasValue)
            attendanceQuery = attendanceQuery.Where(a => a.EmployeeId == employeeId.Value);
        if (allowedEmployeeIds != null)
            attendanceQuery = attendanceQuery.Where(a => allowedEmployeeIds.Contains(a.EmployeeId));

        var records = await attendanceQuery.ToListAsync();
        var empIds = records.Select(r => r.EmployeeId).Distinct().ToList();

        var rosterAssignments = await _db.Set<RosterAssignment>()
            .Include(ra => ra.RosterTemplate).ThenInclude(rt => rt.DefaultShiftPattern)
            .Where(ra => empIds.Contains(ra.EmployeeId))
            .ToListAsync();

        var onLeaveSet = await GetApprovedLeaveDatesAsync(empIds, from.Date, to.Date);

        var results = new List<OvertimeNopayResultDto>();
        foreach (var empGroup in records.GroupBy(r => r.EmployeeId))
        {
            var emp = empGroup.First().Employee;
            var empRosters = rosterAssignments.Where(ra => ra.EmployeeId == empGroup.Key).ToList();

            decimal totalWorked = 0;
            decimal expectedHours = 0;
            int lateDays = 0, presentDays = 0, absentDays = 0;

            var recordsByDate = empGroup.GroupBy(r => r.Date.Date).ToDictionary(g => g.Key, g => g.ToList());

            for (var d = from.Date; d <= to.Date; d = d.AddDays(1))
            {
                var isOnLeave = onLeaveSet.Contains((empGroup.Key, d));
                if (isOnLeave)
                {
                    // Leave day: no expected attendance, don't count as absent
                    continue;
                }

                var (shiftStart, shiftEnd, hoursPerDay) = GetExpectedShift(emp, empRosters, d);
                expectedHours += hoursPerDay;

                if (recordsByDate.TryGetValue(d, out var dayRecords))
                {
                    var dayWorked = dayRecords.Sum(r => r.WorkedHours ?? 0);
                    totalWorked += dayWorked;
                    presentDays++;
                    if (dayRecords.Any(r => r.Status == "Late")) lateDays++;
                }
                else
                {
                    absentDays++;
                }
            }

            var ot = Math.Max(0, totalWorked - expectedHours);
            var nopayHours = Math.Max(0, expectedHours - totalWorked);
            var nopayDays = absentDays;

            results.Add(new OvertimeNopayResultDto
            {
                EmployeeId = empGroup.Key,
                EmployeeName = emp.FirstName + " " + emp.LastName,
                EmployeeCode = emp.EmployeeCode,
                TotalWorkedHours = Math.Round(totalWorked, 2),
                ExpectedHours = Math.Round(expectedHours, 2),
                OvertimeHours = Math.Round(ot, 2),
                NopayDays = nopayDays,
                NopayHours = Math.Round(nopayHours, 2),
                LateDays = lateDays,
                PresentDays = presentDays,
                AbsentDays = absentDays,
            });
        }

        var ordered = results.OrderBy(r => r.EmployeeName).ToList();
        await ApplyOvertimeNopayPeriodApprovalsAsync(ordered, from.Date, to.Date);
        return ordered;
    }

    private async Task ApplyOvertimeNopayPeriodApprovalsAsync(List<OvertimeNopayResultDto> results, DateTime periodFrom, DateTime periodTo)
    {
        if (results.Count == 0) return;

        var ids = results.Select(r => r.EmployeeId).ToList();
        var approvals = await _db.Set<OvertimeNopayPeriodApproval>()
            .AsNoTracking()
            .Include(a => a.Approver)
            .Where(a => !a.IsDeleted && a.PeriodFrom == periodFrom && a.PeriodTo == periodTo && ids.Contains(a.EmployeeId))
            .ToListAsync();

        foreach (var r in results)
        {
            var ap = approvals.FirstOrDefault(a => a.EmployeeId == r.EmployeeId);
            if (ap == null) continue;

            r.OvertimeApprovalStatus = ap.Status.ToString();
            r.OvertimeApprovedAt = ap.ActionAt;
            r.OvertimeApproverName = ap.Approver != null ? ap.Approver.FirstName + " " + ap.Approver.LastName : null;
            r.ApprovedOvertimeHoursSnapshot = ap.OvertimeHoursSnapshot;
            r.OvertimeHoursOutdated = ap.Status == ApprovalStatus.Approved
                && Math.Abs(ap.OvertimeHoursSnapshot - r.OvertimeHours) > 0.02m;
        }
    }

    public async Task<OvertimeNopayResultDto?> SetOvertimeNopayPeriodApprovalAsync(
        DateTime from,
        DateTime to,
        Guid employeeId,
        Guid approverEmployeeId,
        bool approve,
        string? remarks,
        IReadOnlyList<Guid>? allowedEmployeeIds = null)
    {
        if (allowedEmployeeIds != null && !allowedEmployeeIds.Contains(employeeId))
            return null;

        var periodFrom = from.Date;
        var periodTo = to.Date;

        var rows = await CalculateOvertimeNopayAsync(from, to, employeeId, allowedEmployeeIds);
        var row = rows.FirstOrDefault();
        if (row == null) return null;

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

        var refreshed = await CalculateOvertimeNopayAsync(from, to, employeeId, allowedEmployeeIds);
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
                    if (a.PunchIn.HasValue)
                    {
                        var s1Start = a.Date.Date + shift.StartTime;
                        if (a.PunchIn.Value > s1Start.AddMinutes(shift.LateGraceMinutes))
                        {
                            isLate = true;
                            lateMins = (int)(a.PunchIn.Value - s1Start).TotalMinutes;
                        }
                    }
                    if (a.PunchOut.HasValue && shift.Session2EndTime.HasValue)
                    {
                        var s2End = a.Date.Date + shift.Session2EndTime.Value;
                        if (a.PunchOut.Value < s2End.AddMinutes(-shift.EarlyDepartureGraceMinutes))
                        {
                            isEarlyDeparture = true;
                            earlyDepartureMins = (int)(s2End - a.PunchOut.Value).TotalMinutes;
                        }
                    }
                    break;

                default: // Regular, Rotational
                    expectedStart = shift.StartTime;
                    expectedEnd = shift.EndTime;
                    if (a.PunchIn.HasValue)
                    {
                        var expStart = a.Date.Date + shift.StartTime;
                        if (a.PunchIn.Value > expStart.AddMinutes(shift.LateGraceMinutes))
                        {
                            isLate = true;
                            lateMins = (int)(a.PunchIn.Value - expStart).TotalMinutes;
                        }
                    }
                    if (a.PunchOut.HasValue)
                    {
                        var expEnd = a.Date.Date + shift.EndTime;
                        if (shift.IsNightShift && shift.EndTime < shift.StartTime)
                            expEnd = expEnd.AddDays(1);
                        if (a.PunchOut.Value < expEnd.AddMinutes(-shift.EarlyDepartureGraceMinutes))
                        {
                            isEarlyDeparture = true;
                            earlyDepartureMins = (int)(expEnd - a.PunchOut.Value).TotalMinutes;
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
            Date = a.Date,
            PunchIn = a.PunchIn,
            PunchOut = a.PunchOut,
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

    private ShiftPattern? ResolveShiftPattern(Employee emp, List<RosterAssignment> rosters, DateTime date)
    {
        var roster = rosters
            .Where(ra => ra.EmployeeId == emp.Id && ra.EffectiveFrom <= date && (ra.EffectiveTo == null || ra.EffectiveTo >= date))
            .OrderByDescending(ra => ra.EffectiveFrom)
            .FirstOrDefault();

        if (roster?.RosterTemplate?.DefaultShiftPattern != null)
            return roster.RosterTemplate.DefaultShiftPattern;

        if (emp.ShiftPattern != null)
            return emp.ShiftPattern;

        return null;
    }

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

        return (null, null, 8);
    }

    private static (bool applies, TimeSpan? start, TimeSpan? end, decimal hours) GetShiftTimesForDate(
        ShiftPattern shift, DateTime date, TimeSpan defaultStart, TimeSpan defaultEnd, decimal? defaultHours)
    {
        var day = date.DayOfWeek;
        var applies = day switch
        {
            DayOfWeek.Monday => shift.AppliesOnMonday,
            DayOfWeek.Tuesday => shift.AppliesOnTuesday,
            DayOfWeek.Wednesday => shift.AppliesOnWednesday,
            DayOfWeek.Thursday => shift.AppliesOnThursday,
            DayOfWeek.Friday => shift.AppliesOnFriday,
            DayOfWeek.Saturday => shift.AppliesOnSaturday,
            DayOfWeek.Sunday => shift.AppliesOnSunday,
            _ => false
        };
        if (!applies)
            return (false, defaultStart, defaultEnd, 0);

        TimeSpan? dayStart = day switch
        {
            DayOfWeek.Monday => shift.MondayStartTime,
            DayOfWeek.Tuesday => shift.TuesdayStartTime,
            DayOfWeek.Wednesday => shift.WednesdayStartTime,
            DayOfWeek.Thursday => shift.ThursdayStartTime,
            DayOfWeek.Friday => shift.FridayStartTime,
            DayOfWeek.Saturday => shift.SaturdayStartTime,
            DayOfWeek.Sunday => shift.SundayStartTime,
            _ => null
        };
        TimeSpan? dayEnd = day switch
        {
            DayOfWeek.Monday => shift.MondayEndTime,
            DayOfWeek.Tuesday => shift.TuesdayEndTime,
            DayOfWeek.Wednesday => shift.WednesdayEndTime,
            DayOfWeek.Thursday => shift.ThursdayEndTime,
            DayOfWeek.Friday => shift.FridayEndTime,
            DayOfWeek.Saturday => shift.SaturdayEndTime,
            DayOfWeek.Sunday => shift.SundayEndTime,
            _ => null
        };

        if (dayStart.HasValue && dayEnd.HasValue)
        {
            var hours = (decimal)(dayEnd.Value - dayStart.Value).TotalHours - shift.BreakHours;
            return (true, dayStart, dayEnd, Math.Max(0, hours));
        }
        if (defaultHours.HasValue)
            return (true, defaultStart, defaultEnd, defaultHours.Value);
        var fullHours = (decimal)(defaultEnd - defaultStart).TotalHours - shift.BreakHours;
        return (true, defaultStart, defaultEnd, Math.Max(0, fullHours));
    }
}
