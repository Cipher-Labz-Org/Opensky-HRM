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
            AppliesOnMonday = dto.AppliesOnMonday,
            AppliesOnTuesday = dto.AppliesOnTuesday,
            AppliesOnWednesday = dto.AppliesOnWednesday,
            AppliesOnThursday = dto.AppliesOnThursday,
            AppliesOnFriday = dto.AppliesOnFriday,
            AppliesOnSaturday = dto.AppliesOnSaturday,
            AppliesOnSunday = dto.AppliesOnSunday,
            MondayStartTime = dto.MondayStartTime,
            MondayEndTime = dto.MondayEndTime,
            TuesdayStartTime = dto.TuesdayStartTime,
            TuesdayEndTime = dto.TuesdayEndTime,
            WednesdayStartTime = dto.WednesdayStartTime,
            WednesdayEndTime = dto.WednesdayEndTime,
            ThursdayStartTime = dto.ThursdayStartTime,
            ThursdayEndTime = dto.ThursdayEndTime,
            FridayStartTime = dto.FridayStartTime,
            FridayEndTime = dto.FridayEndTime,
            SaturdayStartTime = dto.SaturdayStartTime,
            SaturdayEndTime = dto.SaturdayEndTime,
            SundayStartTime = dto.SundayStartTime,
            SundayEndTime = dto.SundayEndTime,
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
        entity.AppliesOnMonday = dto.AppliesOnMonday;
        entity.AppliesOnTuesday = dto.AppliesOnTuesday;
        entity.AppliesOnWednesday = dto.AppliesOnWednesday;
        entity.AppliesOnThursday = dto.AppliesOnThursday;
        entity.AppliesOnFriday = dto.AppliesOnFriday;
        entity.AppliesOnSaturday = dto.AppliesOnSaturday;
        entity.AppliesOnSunday = dto.AppliesOnSunday;
        entity.MondayStartTime = dto.MondayStartTime;
        entity.MondayEndTime = dto.MondayEndTime;
        entity.TuesdayStartTime = dto.TuesdayStartTime;
        entity.TuesdayEndTime = dto.TuesdayEndTime;
        entity.WednesdayStartTime = dto.WednesdayStartTime;
        entity.WednesdayEndTime = dto.WednesdayEndTime;
        entity.ThursdayStartTime = dto.ThursdayStartTime;
        entity.ThursdayEndTime = dto.ThursdayEndTime;
        entity.FridayStartTime = dto.FridayStartTime;
        entity.FridayEndTime = dto.FridayEndTime;
        entity.SaturdayStartTime = dto.SaturdayStartTime;
        entity.SaturdayEndTime = dto.SaturdayEndTime;
        entity.SundayStartTime = dto.SundayStartTime;
        entity.SundayEndTime = dto.SundayEndTime;
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
        AppliesOnMonday = s.AppliesOnMonday,
        AppliesOnTuesday = s.AppliesOnTuesday,
        AppliesOnWednesday = s.AppliesOnWednesday,
        AppliesOnThursday = s.AppliesOnThursday,
        AppliesOnFriday = s.AppliesOnFriday,
        AppliesOnSaturday = s.AppliesOnSaturday,
        AppliesOnSunday = s.AppliesOnSunday,
        MondayStartTime = s.MondayStartTime,
        MondayEndTime = s.MondayEndTime,
        TuesdayStartTime = s.TuesdayStartTime,
        TuesdayEndTime = s.TuesdayEndTime,
        WednesdayStartTime = s.WednesdayStartTime,
        WednesdayEndTime = s.WednesdayEndTime,
        ThursdayStartTime = s.ThursdayStartTime,
        ThursdayEndTime = s.ThursdayEndTime,
        FridayStartTime = s.FridayStartTime,
        FridayEndTime = s.FridayEndTime,
        SaturdayStartTime = s.SaturdayStartTime,
        SaturdayEndTime = s.SaturdayEndTime,
        SundayStartTime = s.SundayStartTime,
        SundayEndTime = s.SundayEndTime,
        IsActive = s.IsActive,
    };
}
