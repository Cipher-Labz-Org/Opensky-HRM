using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Application.DTOs.LeaveAttendance;
using OpenSkyHRM.Application.Interfaces;
using OpenSkyHRM.Domain;
using OpenSkyHRM.Domain.Entities;
using OpenSkyHRM.Domain.Enums;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

internal sealed class AttendancePunchPolicy
{
    public AttendancePlace? ResolvedPlace { get; init; }
}

internal static class AttendancePunchPolicyEvaluator
{
    public static async Task<AttendancePunchPolicy> EvaluateAsync(
        AppDbContext db,
        ISystemSettingService settings,
        Guid employeeId,
        PunchRequestDto dto)
    {
        var mode = AttendanceCheckInModes.Normalize(
            await settings.GetAsync(AttendanceCheckInModes.SettingKey));

        if (mode == AttendanceCheckInModes.Open)
            return new AttendancePunchPolicy();

        var employee = await db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted)
            ?? throw new InvalidOperationException("Employee not found.");

        AttendancePlace? place = null;

        switch (mode)
        {
            case AttendanceCheckInModes.LocationGeofence:
                place = dto.LocationId.HasValue && dto.LocationId != Guid.Empty
                    ? await ResolveLocationPlaceByLocationIdAsync(db, dto.LocationId.Value)
                    : await ResolveLocationPlaceAsync(db, employee);
                RequireGpsInsidePlace(dto, place, "location");
                break;

            case AttendanceCheckInModes.BusinessUnitQr:
                RequireQrPayload(dto);
                if (HasScannedLocation(dto))
                {
                    place = await TryResolveLocationPlaceAsync(db, dto.LocationId!.Value);
                    return new AttendancePunchPolicy { ResolvedPlace = place };
                }

                EnsureBusinessUnit(dto, employee);
                break;

            case AttendanceCheckInModes.BusinessUnitGeofence:
                EnsureBusinessUnit(dto, employee);
                place = await ResolveBusinessUnitPlaceAsync(db, dto.BusinessUnitId!.Value);
                RequireGpsInsidePlace(dto, place, "business unit");
                break;

            case AttendanceCheckInModes.Hybrid:
                RequireQrPayload(dto);
                if (HasScannedLocation(dto))
                {
                    place = await ResolveLocationPlaceByLocationIdAsync(db, dto.LocationId!.Value);
                    RequireGpsInsidePlace(dto, place, "location");
                    return new AttendancePunchPolicy { ResolvedPlace = place };
                }

                EnsureBusinessUnit(dto, employee);
                place = await ResolveBusinessUnitPlaceAsync(db, dto.BusinessUnitId!.Value);
                RequireGpsInsidePlace(dto, place, "business unit");
                break;

            default:
                return new AttendancePunchPolicy();
        }

        return new AttendancePunchPolicy { ResolvedPlace = place };
    }

    /// <summary>
    /// After the API layer resolves QR into BusinessUnitId/LocationId, ensure the punch matches the employee's assignment.
    /// </summary>
    public static void ValidateEmployeeMatchesScannedQr(Employee employee, PunchRequestDto dto)
    {
        if (dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty
            && employee.BusinessUnitId.HasValue && employee.BusinessUnitId != Guid.Empty
            && employee.BusinessUnitId != dto.BusinessUnitId)
        {
            throw new InvalidOperationException("This QR code is not for your business unit.");
        }

        if (dto.LocationId.HasValue && dto.LocationId != Guid.Empty
            && employee.LocationId.HasValue && employee.LocationId != Guid.Empty
            && employee.LocationId != dto.LocationId)
        {
            throw new InvalidOperationException("This QR code is not for your location.");
        }
    }

    private static void RequireQrPayload(PunchRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.QrPayload))
            throw new InvalidOperationException("A valid attendance QR code is required for check-in.");
    }

    private static bool HasScannedLocation(PunchRequestDto dto) =>
        dto.LocationId.HasValue && dto.LocationId != Guid.Empty;

    private static void EnsureBusinessUnit(PunchRequestDto dto, Employee employee)
    {
        if (dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty)
            return;

        if (employee.BusinessUnitId.HasValue && employee.BusinessUnitId != Guid.Empty)
        {
            dto.BusinessUnitId = employee.BusinessUnitId;
            return;
        }

        throw new InvalidOperationException("Business unit is required for this check-in mode.");
    }

    private static async Task<AttendancePlace?> TryResolveLocationPlaceAsync(AppDbContext db, Guid locationId) =>
        await db.AttendancePlaces.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                !p.IsDeleted
                && p.IsActive
                && p.Kind == AttendancePlaceKind.Location
                && p.LocationId == locationId);

    private static async Task<AttendancePlace> ResolveLocationPlaceByLocationIdAsync(AppDbContext db, Guid locationId)
    {
        var place = await TryResolveLocationPlaceAsync(db, locationId);

        if (place is null)
            throw new InvalidOperationException("No attendance place configured for this location.");

        return place;
    }

    private static async Task<AttendancePlace> ResolveLocationPlaceAsync(AppDbContext db, Employee employee)
    {
        if (!employee.LocationId.HasValue || employee.LocationId == Guid.Empty)
            throw new InvalidOperationException("Employee has no assigned location for location-based check-in.");

        var place = await db.AttendancePlaces.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                !p.IsDeleted
                && p.IsActive
                && p.Kind == AttendancePlaceKind.Location
                && p.LocationId == employee.LocationId);

        if (place is null)
            throw new InvalidOperationException("No attendance place configured for the employee's location.");

        return place;
    }

    private static async Task<AttendancePlace> ResolveBusinessUnitPlaceAsync(AppDbContext db, Guid businessUnitId)
    {
        var place = await db.AttendancePlaces.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                !p.IsDeleted
                && p.IsActive
                && p.Kind == AttendancePlaceKind.BusinessUnit
                && p.BusinessUnitId == businessUnitId);

        if (place is null)
            throw new InvalidOperationException("No attendance place configured for this business unit.");

        return place;
    }

    private static void RequireGpsInsidePlace(PunchRequestDto dto, AttendancePlace place, string placeLabel)
    {
        if (!place.GeofenceEnabled)
            throw new InvalidOperationException($"Geofence is not enabled for this {placeLabel} attendance place.");

        if (!place.Latitude.HasValue || !place.Longitude.HasValue)
            throw new InvalidOperationException($"Coordinates are not configured for this {placeLabel} attendance place.");

        if (!dto.Latitude.HasValue || !dto.Longitude.HasValue)
            throw new InvalidOperationException("GPS location is required for check-in.");

        if (!GeofenceValidator.IsWithinRadius(
                dto.Latitude.Value,
                dto.Longitude.Value,
                place.Latitude.Value,
                place.Longitude.Value,
                place.GeofenceRadiusMeters))
        {
            throw new InvalidOperationException(
                $"Check-in must be within {place.GeofenceRadiusMeters} meters of the configured {placeLabel}.");
        }
    }
}
