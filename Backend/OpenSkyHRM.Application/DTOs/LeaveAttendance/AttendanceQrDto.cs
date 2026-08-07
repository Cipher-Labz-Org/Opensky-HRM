namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

/// <summary>Stable QR payload for an attendance place (printable / displayable).</summary>
public class AttendanceQrDto
{
    public string Kind { get; set; } = string.Empty;
    public Guid EntityId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    /// <summary>JSON string encoded into the QR image for mobile scanners.</summary>
    public string Payload { get; set; } = string.Empty;
}

/// <summary>Legacy shape for business-unit QR responses.</summary>
public class BusinessUnitAttendanceQrDto
{
    public Guid BusinessUnitId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
}

/// <summary>Legacy shape for location QR responses.</summary>
public class LocationAttendanceQrDto
{
    public Guid LocationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
}

public class ValidateBusinessUnitAttendanceQrRequestDto
{
    public string? Token { get; set; }
    public string? Payload { get; set; }
}

public class ValidateBusinessUnitAttendanceQrResultDto
{
    public bool Valid { get; set; }
    public string? Message { get; set; }
    public string? Kind { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public string? BusinessUnitName { get; set; }
    public string? BusinessUnitCode { get; set; }
    public Guid? LocationId { get; set; }
    public string? LocationName { get; set; }
    public string? LocationCode { get; set; }
}
