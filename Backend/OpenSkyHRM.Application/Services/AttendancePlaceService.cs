using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Application.Services;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

public class AttendancePlaceService : IAttendancePlaceService
{
    private readonly AppDbContext _db;

    public AttendancePlaceService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<List<AttendancePlaceDto>> GetAllAsync()
    {
        var places = await _db.AttendancePlaces
            .AsNoTracking()
            .Include(p => p.Location)
            .Include(p => p.BusinessUnit)
            .OrderBy(p => p.Name)
            .ToListAsync();
        return places.Select(MapToDto).ToList();
    }

    public async Task<AttendancePlaceDto?> GetByIdAsync(Guid id)
    {
        var place = await _db.AttendancePlaces
            .AsNoTracking()
            .Include(p => p.Location)
            .Include(p => p.BusinessUnit)
            .FirstOrDefaultAsync(p => p.Id == id);
        return place is null ? null : MapToDto(place);
    }

    public async Task<AttendancePlaceDto> CreateAsync(CreateAttendancePlaceDto dto)
    {
        var reusable = await FindReusablePlaceAsync(dto);
        if (reusable != null)
        {
            reusable.IsDeleted = false;
            await ApplyDtoAsync(reusable, dto, isCreate: false);
            await _db.SaveChangesAsync();
            return (await GetByIdAsync(reusable.Id))!;
        }

        var entity = new AttendancePlace();
        await ApplyDtoAsync(entity, dto, isCreate: true);
        _db.AttendancePlaces.Add(entity);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(entity.Id))!;
    }

    public async Task<AttendancePlaceDto?> UpdateAsync(Guid id, UpdateAttendancePlaceDto dto)
    {
        var entity = await _db.AttendancePlaces
            .Include(p => p.Location)
            .Include(p => p.BusinessUnit)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;

        await ApplyDtoAsync(entity, dto, isCreate: false);
        await _db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await _db.AttendancePlaces.FindAsync(id);
        if (entity is null) return false;
        entity.IsDeleted = true;
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task ApplyDtoAsync(AttendancePlace entity, CreateAttendancePlaceDto dto, bool isCreate)
    {
        ValidateKindLinks(dto);

        var radius = GeofenceValidator.NormalizeRadius(dto.GeofenceRadiusMeters);
        GeofenceValidator.ValidateGeoFields(dto.GeofenceEnabled, radius, dto.Latitude, dto.Longitude);

        if (dto.Kind == AttendancePlaceKind.Location)
        {
            var location = await _db.Locations.AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == dto.LocationId && !l.IsDeleted)
                ?? throw new InvalidOperationException("Location not found.");

            if (isCreate || entity.LocationId != dto.LocationId)
            {
                var duplicate = await _db.AttendancePlaces.AnyAsync(p =>
                    !p.IsDeleted && p.LocationId == dto.LocationId && p.Id != entity.Id);
                if (duplicate)
                    throw new InvalidOperationException("An attendance place already exists for this location.");
            }

            entity.Kind = AttendancePlaceKind.Location;
            entity.LocationId = dto.LocationId;
            entity.BusinessUnitId = null;
            entity.Name = string.IsNullOrWhiteSpace(dto.Name) ? location.Name : dto.Name.Trim();
            entity.Code = string.IsNullOrWhiteSpace(dto.Code) ? $"LOC-{location.Code}" : dto.Code.Trim();
        }
        else
        {
            var bu = await _db.BusinessUnits.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == dto.BusinessUnitId && !b.IsDeleted)
                ?? throw new InvalidOperationException("Business unit not found.");

            if (isCreate || entity.BusinessUnitId != dto.BusinessUnitId)
            {
                var duplicate = await _db.AttendancePlaces.AnyAsync(p =>
                    !p.IsDeleted && p.BusinessUnitId == dto.BusinessUnitId && p.Id != entity.Id);
                if (duplicate)
                    throw new InvalidOperationException("An attendance place already exists for this business unit.");
            }

            entity.Kind = AttendancePlaceKind.BusinessUnit;
            entity.BusinessUnitId = dto.BusinessUnitId;
            entity.LocationId = null;
            entity.Name = string.IsNullOrWhiteSpace(dto.Name) ? bu.Name : dto.Name.Trim();
            entity.Code = string.IsNullOrWhiteSpace(dto.Code) ? $"BU-{bu.Code}" : dto.Code.Trim();
        }

        entity.IsActive = dto.IsActive;
        entity.GeofenceEnabled = dto.GeofenceEnabled;
        entity.GeofenceRadiusMeters = radius;
        entity.Latitude = dto.Latitude;
        entity.Longitude = dto.Longitude;
    }

    /// <summary>
    /// Reuses a soft-deleted place or an orphaned place left after master-data deletion.
    /// </summary>
    private async Task<AttendancePlace?> FindReusablePlaceAsync(CreateAttendancePlaceDto dto)
    {
        if (dto.Kind == AttendancePlaceKind.Location && dto.LocationId.HasValue)
        {
            var deleted = await _db.AttendancePlaces.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p =>
                    p.IsDeleted
                    && p.Kind == AttendancePlaceKind.Location
                    && p.LocationId == dto.LocationId);
            if (deleted != null) return deleted;

            var expectedCode = await ResolveExpectedCodeAsync(dto);
            if (expectedCode == null) return null;

            return await FindOrphanByCodeAsync(
                expectedCode,
                AttendancePlaceKind.Location,
                dto.LocationId.Value,
                isLocation: true);
        }

        if (dto.Kind == AttendancePlaceKind.BusinessUnit && dto.BusinessUnitId.HasValue)
        {
            var deleted = await _db.AttendancePlaces.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p =>
                    p.IsDeleted
                    && p.Kind == AttendancePlaceKind.BusinessUnit
                    && p.BusinessUnitId == dto.BusinessUnitId);
            if (deleted != null) return deleted;

            var expectedCode = await ResolveExpectedCodeAsync(dto);
            if (expectedCode == null) return null;

            var byCode = await _db.AttendancePlaces.IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.IsDeleted && p.Code == expectedCode);
            if (byCode != null) return byCode;

            return await FindOrphanByCodeAsync(
                expectedCode,
                AttendancePlaceKind.BusinessUnit,
                dto.BusinessUnitId.Value,
                isLocation: false);
        }

        return null;
    }

    private async Task<string?> ResolveExpectedCodeAsync(CreateAttendancePlaceDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.Code))
            return dto.Code.Trim();

        if (dto.Kind == AttendancePlaceKind.Location && dto.LocationId.HasValue)
        {
            var location = await _db.Locations.AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == dto.LocationId && !l.IsDeleted);
            return location is null ? null : $"LOC-{location.Code}";
        }

        if (dto.Kind == AttendancePlaceKind.BusinessUnit && dto.BusinessUnitId.HasValue)
        {
            var bu = await _db.BusinessUnits.AsNoTracking()
                .FirstOrDefaultAsync(b => b.Id == dto.BusinessUnitId && !b.IsDeleted);
            return bu is null ? null : $"BU-{bu.Code}";
        }

        return null;
    }

    private async Task<AttendancePlace?> FindOrphanByCodeAsync(
        string expectedCode,
        AttendancePlaceKind kind,
        Guid linkedId,
        bool isLocation)
    {
        var orphan = await _db.AttendancePlaces.IgnoreQueryFilters()
            .FirstOrDefaultAsync(p =>
                !p.IsDeleted
                && p.Kind == kind
                && p.Code == expectedCode
                && (isLocation ? p.LocationId != linkedId : p.BusinessUnitId != linkedId));

        if (orphan == null) return null;

        var linkedEntityDeleted = isLocation
            ? orphan.LocationId.HasValue && await _db.Locations.IgnoreQueryFilters()
                .AnyAsync(l => l.Id == orphan.LocationId && l.IsDeleted)
            : orphan.BusinessUnitId.HasValue && await _db.BusinessUnits.IgnoreQueryFilters()
                .AnyAsync(b => b.Id == orphan.BusinessUnitId && b.IsDeleted);

        return linkedEntityDeleted ? orphan : null;
    }

    private static void ValidateKindLinks(CreateAttendancePlaceDto dto)
    {
        if (dto.Kind == AttendancePlaceKind.Location)
        {
            if (!dto.LocationId.HasValue || dto.LocationId == Guid.Empty)
                throw new InvalidOperationException("Location is required for a location-based attendance place.");
            if (dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty)
                throw new InvalidOperationException("Business unit must not be set for a location-based attendance place.");
        }
        else if (dto.Kind == AttendancePlaceKind.BusinessUnit)
        {
            if (!dto.BusinessUnitId.HasValue || dto.BusinessUnitId == Guid.Empty)
                throw new InvalidOperationException("Business unit is required for a business-unit attendance place.");
            if (dto.LocationId.HasValue && dto.LocationId != Guid.Empty)
                throw new InvalidOperationException("Location must not be set for a business-unit attendance place.");
        }
        else
        {
            throw new InvalidOperationException("Invalid attendance place kind.");
        }
    }

    private static AttendancePlaceDto MapToDto(AttendancePlace p) => new()
    {
        Id = p.Id,
        Name = p.Name,
        Code = p.Code,
        Kind = p.Kind,
        IsActive = p.IsActive,
        GeofenceEnabled = p.GeofenceEnabled,
        GeofenceRadiusMeters = p.GeofenceRadiusMeters,
        Latitude = p.Latitude,
        Longitude = p.Longitude,
        LocationId = p.LocationId,
        LocationName = p.Location?.Name,
        LocationAddress = p.Location?.Address,
        BusinessUnitId = p.BusinessUnitId,
        BusinessUnitName = p.BusinessUnit?.Name,
        HasCoordinatesConfigured = p.Latitude.HasValue && p.Longitude.HasValue,
    };
}
