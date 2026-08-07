using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

public class AttendancePlaceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public AttendancePlaceKind Kind { get; set; }
    public bool IsActive { get; set; }
    public bool GeofenceEnabled { get; set; }
    public int GeofenceRadiusMeters { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public Guid? LocationId { get; set; }
    public string? LocationName { get; set; }
    public string? LocationAddress { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public string? BusinessUnitName { get; set; }
    public bool HasCoordinatesConfigured { get; set; }
}

public class CreateAttendancePlaceDto
{
    public string? Name { get; set; }
    public string? Code { get; set; }
    public AttendancePlaceKind Kind { get; set; }
    public bool IsActive { get; set; } = true;
    public bool GeofenceEnabled { get; set; }
    public int GeofenceRadiusMeters { get; set; } = 20;
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? BusinessUnitId { get; set; }
}

public class UpdateAttendancePlaceDto : CreateAttendancePlaceDto
{
}
