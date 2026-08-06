namespace OpenSkyHRM.Application.DTOs.LeaveAttendance;

/// <summary>Stable QR payload for a business unit location (printable / displayable).</summary>
public class BusinessUnitAttendanceQrDto
{
    public Guid BusinessUnitId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    /// <summary>JSON string encoded into the QR image for mobile scanners.</summary>
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
    public Guid? BusinessUnitId { get; set; }
    public string? BusinessUnitName { get; set; }
    public string? BusinessUnitCode { get; set; }
}
