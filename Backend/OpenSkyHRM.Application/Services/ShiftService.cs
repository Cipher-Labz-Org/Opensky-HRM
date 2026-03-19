using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.TimeAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class ShiftService : IShiftService
{
    private readonly AppDbContext _db;

    public ShiftService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<ShiftPatternDto>> GetAllAsync(bool includeInactive = false)
    {
        var query = _db.Set<ShiftPattern>().Where(s => !s.IsDeleted);
        if (!includeInactive)
            query = query.Where(s => s.IsActive);

        return await query
            .OrderBy(s => s.Name)
            .Select(s => MapToDto(s))
            .ToListAsync();
    }

    public async Task<ShiftPatternDto?> GetByIdAsync(Guid id)
    {
        var entity = await _db.Set<ShiftPattern>().FindAsync(id);
        if (entity is null) return null;
        return MapToDto(entity);
    }

    public async Task<ShiftPatternDto> CreateAsync(CreateShiftPatternDto dto)
    {
        var exists = await _db.Set<ShiftPattern>()
            .AnyAsync(s => s.Code == dto.Code);
        if (exists)
            throw new InvalidOperationException($"A shift with code '{dto.Code}' already exists.");

        var entity = new ShiftPattern
        {
            Name = dto.Name,
            Code = dto.Code,
            ShiftType = dto.ShiftType,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime,
            BreakHours = dto.BreakHours,
            IsNightShift = dto.IsNightShift,
            Session2StartTime = dto.Session2StartTime,
            Session2EndTime = dto.Session2EndTime,
            FlexiWindowStart = dto.FlexiWindowStart,
            FlexiWindowEnd = dto.FlexiWindowEnd,
            MinimumWorkHours = dto.MinimumWorkHours,
            LateGraceMinutes = dto.LateGraceMinutes,
            EarlyDepartureGraceMinutes = dto.EarlyDepartureGraceMinutes,
            HalfDayHours = dto.HalfDayHours,
            IsActive = dto.IsActive,
        };
        _db.Set<ShiftPattern>().Add(entity);
        await _db.SaveChangesAsync();

        return MapToDto(entity);
    }

    public async Task<ShiftPatternDto?> UpdateAsync(Guid id, UpdateShiftPatternDto dto)
    {
        var entity = await _db.Set<ShiftPattern>().FindAsync(id);
        if (entity is null) return null;

        var duplicateCode = await _db.Set<ShiftPattern>()
            .AnyAsync(s => s.Code == dto.Code && s.Id != id);
        if (duplicateCode)
            throw new InvalidOperationException($"A shift with code '{dto.Code}' already exists.");

        entity.Name = dto.Name;
        entity.Code = dto.Code;
        entity.ShiftType = dto.ShiftType;
        entity.StartTime = dto.StartTime;
        entity.EndTime = dto.EndTime;
        entity.BreakHours = dto.BreakHours;
        entity.IsNightShift = dto.IsNightShift;
        entity.Session2StartTime = dto.Session2StartTime;
        entity.Session2EndTime = dto.Session2EndTime;
        entity.FlexiWindowStart = dto.FlexiWindowStart;
        entity.FlexiWindowEnd = dto.FlexiWindowEnd;
        entity.MinimumWorkHours = dto.MinimumWorkHours;
        entity.LateGraceMinutes = dto.LateGraceMinutes;
        entity.EarlyDepartureGraceMinutes = dto.EarlyDepartureGraceMinutes;
        entity.HalfDayHours = dto.HalfDayHours;
        entity.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();

        return MapToDto(entity);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _db.Set<ShiftPattern>().FindAsync(id);
        if (entity is null) return false;

        var inUse = await _db.Employees.AnyAsync(e => e.ShiftPatternId == id);
        if (inUse)
            throw new InvalidOperationException("Cannot delete shift: it is assigned to one or more employees.");

        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private static ShiftPatternDto MapToDto(ShiftPattern s) => new()
    {
        Id = s.Id,
        Name = s.Name,
        Code = s.Code,
        ShiftType = s.ShiftType,
        StartTime = s.StartTime,
        EndTime = s.EndTime,
        BreakHours = s.BreakHours,
        IsNightShift = s.IsNightShift,
        Session2StartTime = s.Session2StartTime,
        Session2EndTime = s.Session2EndTime,
        FlexiWindowStart = s.FlexiWindowStart,
        FlexiWindowEnd = s.FlexiWindowEnd,
        MinimumWorkHours = s.MinimumWorkHours,
        LateGraceMinutes = s.LateGraceMinutes,
        EarlyDepartureGraceMinutes = s.EarlyDepartureGraceMinutes,
        HalfDayHours = s.HalfDayHours,
        IsActive = s.IsActive,
    };
}
