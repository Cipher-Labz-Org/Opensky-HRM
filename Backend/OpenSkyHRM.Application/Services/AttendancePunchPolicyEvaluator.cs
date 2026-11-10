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

        // Desktop header punch records attendance without a mobile QR/geofence scan
        // and is not limited by business-unit or location mobile punch access.
        if (string.Equals(dto.Source?.Trim(), "Web", StringComparison.OrdinalIgnoreCase))
            return new AttendancePunchPolicy();

        if (mode == AttendanceCheckInModes.Open)
        {
            if (MobilePunchAccess.IsMobileSource(dto.Source))
                await MobilePunchAccess.EnsureEmployeeAsync(db, employeeId);
            return new AttendancePunchPolicy();
        }

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
                if (MobilePunchAccess.IsMobileSource(dto.Source))
                {
                    var locationId = place.LocationId ?? employee.LocationId
                        ?? throw new InvalidOperationException(MobilePunchAccess.LocationDenied);
                    await MobilePunchAccess.EnsureLocationAsync(db, locationId);
                }
                RequireGpsInsidePlace(dto, place, "location");
                break;

            case AttendanceCheckInModes.BusinessUnitQr:
                RequireQrPayload(dto);
                if (HasScannedLocation(dto))
                {
                    EnsureEmployeeMatchesLocation(dto, employee);
                    if (MobilePunchAccess.IsMobileSource(dto.Source))
                        await MobilePunchAccess.EnsureLocationAsync(db, dto.LocationId!.Value);
                    place = await TryResolveLocationPlaceAsync(db, dto.LocationId!.Value);
                    return new AttendancePunchPolicy { ResolvedPlace = place };
                }

                EnsureBusinessUnit(dto, employee);
                EnsureEmployeeMatchesBusinessUnit(dto, employee);
                if (MobilePunchAccess.IsMobileSource(dto.Source))
                    await MobilePunchAccess.EnsureBusinessUnitAsync(db, dto.BusinessUnitId!.Value);
                break;

            case AttendanceCheckInModes.BusinessUnitGeofence:
                EnsureBusinessUnit(dto, employee);
                EnsureEmployeeMatchesBusinessUnit(dto, employee);
                if (MobilePunchAccess.IsMobileSource(dto.Source))
                    await MobilePunchAccess.EnsureBusinessUnitAsync(db, dto.BusinessUnitId!.Value);
                place = await ResolveBusinessUnitPlaceAsync(db, dto.BusinessUnitId!.Value);
                RequireGpsInsidePlace(dto, place, "business unit");
                break;

            case AttendanceCheckInModes.Hybrid:
                RequireQrPayload(dto);
                if (HasScannedLocation(dto))
                {
                    EnsureEmployeeMatchesLocation(dto, employee);
                    if (MobilePunchAccess.IsMobileSource(dto.Source))
                        await MobilePunchAccess.EnsureLocationAsync(db, dto.LocationId!.Value);
                    place = await ResolveLocationPlaceByLocationIdAsync(db, dto.LocationId!.Value);
                    RequireGpsInsidePlace(dto, place, "location");
                    return new AttendancePunchPolicy { ResolvedPlace = place };
                }

                EnsureBusinessUnit(dto, employee);
                EnsureEmployeeMatchesBusinessUnit(dto, employee);
                if (MobilePunchAccess.IsMobileSource(dto.Source))
                    await MobilePunchAccess.EnsureBusinessUnitAsync(db, dto.BusinessUnitId!.Value);
                place = await ResolveBusinessUnitPlaceAsync(db, dto.BusinessUnitId!.Value);
                RequireGpsInsidePlace(dto, place, "business unit");
                break;

            default:
                return new AttendancePunchPolicy();
        }

        return new AttendancePunchPolicy { ResolvedPlace = place };
    }

    /// <summary>
    /// When a mobile/web QR punch is used, the scanned business unit or location must match the employee profile.
    /// Applies regardless of company check-in mode (including Open).
    /// </summary>
    public static void ValidateEmployeeMatchesScannedQr(Employee employee, PunchRequestDto dto)
    {
        if (HasScannedLocation(dto))
        {
            EnsureEmployeeMatchesLocation(dto, employee);
            return;
        }

        if (dto.BusinessUnitId.HasValue && dto.BusinessUnitId != Guid.Empty)
            EnsureEmployeeMatchesBusinessUnit(dto, employee);
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

    /// <summary>QR business unit must match the employee's assigned business unit.</summary>
    private static void EnsureEmployeeMatchesBusinessUnit(PunchRequestDto dto, Employee employee)
    {
        if (!dto.BusinessUnitId.HasValue || dto.BusinessUnitId == Guid.Empty)
            return;

        if (!employee.BusinessUnitId.HasValue || employee.BusinessUnitId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "Your employee profile has no business unit assigned. Contact HR before checking in.");
        }

        if (employee.BusinessUnitId.Value != dto.BusinessUnitId.Value)
        {
            throw new InvalidOperationException(
                "This QR code belongs to a different business unit. Scan the QR at your assigned business unit.");
        }
    }

    /// <summary>QR location must match the employee's assigned location.</summary>
    private static void EnsureEmployeeMatchesLocation(PunchRequestDto dto, Employee employee)
    {
        if (!dto.LocationId.HasValue || dto.LocationId == Guid.Empty)
            return;

        if (!employee.LocationId.HasValue || employee.LocationId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "Your employee profile has no location assigned. Contact HR before checking in.");
        }

        if (employee.LocationId.Value != dto.LocationId.Value)
        {
            throw new InvalidOperationException(
                "This QR code belongs to a different location. Scan the QR at your assigned location.");
        }
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
