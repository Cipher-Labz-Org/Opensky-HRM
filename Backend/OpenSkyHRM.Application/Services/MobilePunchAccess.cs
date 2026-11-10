using Microsoft.EntityFrameworkCore;
using OpenSkyHRM.Persistence;

namespace OpenSkyHRM.Application.Services;

/// <summary>
/// Mobile punch in and punch out is allowed only for business units and locations
/// that an administrator has granted access to.
/// </summary>
public static class MobilePunchAccess
{
    public const string BusinessUnitDenied =
        "Mobile punch in and punch out is not enabled for this business unit.";

    public const string LocationDenied =
        "Mobile punch in and punch out is not enabled for this location.";

    public const string EmployeeDenied =
        "Mobile punch in and punch out is not enabled for your business unit or location.";

    public static bool IsMobileSource(string? source)
    {
        var value = source?.Trim();
        if (string.IsNullOrEmpty(value))
            return true;
        return value.StartsWith("Mobile", StringComparison.OrdinalIgnoreCase);
    }

    public static async Task EnsureBusinessUnitAsync(AppDbContext db, Guid businessUnitId)
    {
        var allowed = await db.BusinessUnits.AsNoTracking()
            .AnyAsync(b => b.Id == businessUnitId && !b.IsDeleted && b.IsActive && b.AllowMobilePunch);
        if (!allowed)
            throw new InvalidOperationException(BusinessUnitDenied);
    }

    public static async Task EnsureLocationAsync(AppDbContext db, Guid locationId)
    {
        var allowed = await db.Locations.AsNoTracking()
            .AnyAsync(l => l.Id == locationId && !l.IsDeleted && l.IsActive && l.AllowMobilePunch);
        if (!allowed)
            throw new InvalidOperationException(LocationDenied);
    }

    /// <summary>
    /// Open punch, or a punch that can use either a business-unit or a location code:
    /// allowed when the employee's business unit or location has been granted access.
    /// </summary>
    public static async Task EnsureEmployeeAsync(AppDbContext db, Guid employeeId)
    {
        var employee = await db.Employees.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == employeeId && !e.IsDeleted)
            ?? throw new InvalidOperationException("Employee not found.");

        var buAllowed = employee.BusinessUnitId is Guid buId && buId != Guid.Empty
            && await db.BusinessUnits.AsNoTracking().AnyAsync(b =>
                b.Id == buId && !b.IsDeleted && b.IsActive && b.AllowMobilePunch);

        var locationAllowed = employee.LocationId is Guid locId && locId != Guid.Empty
            && await db.Locations.AsNoTracking().AnyAsync(l =>
                l.Id == locId && !l.IsDeleted && l.IsActive && l.AllowMobilePunch);

        if (!buAllowed && !locationAllowed)
            throw new InvalidOperationException(EmployeeDenied);
    }
}
