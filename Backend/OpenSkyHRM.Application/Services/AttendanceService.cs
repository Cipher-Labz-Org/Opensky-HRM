using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.Common;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AttendanceService : IAttendanceService
{
    private readonly AppDbContext _db;

    public AttendanceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<AttendanceRecordDto>> GetAttendanceAsync(int page = 1, int pageSize = 20, Guid? employeeId = null, DateTime? date = null)
    {
        var query = _db.Set<AttendanceRecord>()
            .Include(a => a.Employee)
            .AsQueryable();

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);

        if (date.HasValue)
            query = query.Where(a => a.Date.Date == date.Value.Date);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(a => a.Date)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AttendanceRecordDto
            {
                Id = a.Id,
                EmployeeName = a.Employee.FirstName + " " + a.Employee.LastName,
                EmployeeId = a.EmployeeId,
                Date = a.Date,
                PunchIn = a.PunchIn,
                PunchOut = a.PunchOut,
                WorkedHours = a.WorkedHours,
                Status = a.Status,
                Remarks = a.Remarks,
            })
            .ToListAsync();

        return new PagedResult<AttendanceRecordDto> { Items = items, TotalCount = total, Page = page, PageSize = pageSize };
    }

    public async Task<AttendanceSummaryDto> GetSummaryAsync(DateTime from, DateTime to, Guid? employeeId = null)
    {
        var query = _db.Set<AttendanceRecord>()
            .Where(a => a.Date >= from && a.Date <= to);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);

        var records = await query.ToListAsync();

        return new AttendanceSummaryDto
        {
            TotalPresent = records.Count(r => r.Status == "Present"),
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
            workedHours = (decimal)(dto.PunchOut.Value - dto.PunchIn.Value).TotalHours;

        var entity = new AttendanceRecord
        {
            EmployeeId = dto.EmployeeId,
            Date = dto.Date,
            PunchIn = dto.PunchIn,
            PunchOut = dto.PunchOut,
            WorkedHours = workedHours,
            Status = dto.Status,
            Remarks = dto.Remarks,
            Source = dto.Source ?? "Web",
        };

        _db.Set<AttendanceRecord>().Add(entity);
        await _db.SaveChangesAsync();

        var emp = await _db.Set<Employee>().FindAsync(dto.EmployeeId);

        return new AttendanceRecordDto
        {
            Id = entity.Id,
            EmployeeName = emp != null ? $"{emp.FirstName} {emp.LastName}" : "",
            EmployeeId = entity.EmployeeId,
            Date = entity.Date,
            PunchIn = entity.PunchIn,
            PunchOut = entity.PunchOut,
            WorkedHours = entity.WorkedHours,
            Status = entity.Status,
            Remarks = entity.Remarks,
        };
    }
}
