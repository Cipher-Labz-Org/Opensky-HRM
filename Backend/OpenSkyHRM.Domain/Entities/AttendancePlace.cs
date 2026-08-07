using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// Single store for attendance geofence center coordinates, linked to a Location or BusinessUnit.
/// </summary>
public class AttendancePlace : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public AttendancePlaceKind Kind { get; set; }
    public bool IsActive { get; set; } = true;

    public bool GeofenceEnabled { get; set; }
    public int GeofenceRadiusMeters { get; set; } = 20;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public Guid? BusinessUnitId { get; set; }
    public BusinessUnit? BusinessUnit { get; set; }

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
}
