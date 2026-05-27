namespace OpenSkyHRM.Application.DTOs.TimeAttendance;

public class BiometricDeviceDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

public class CreateBiometricDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = "Fingerprint";
    public bool IsActive { get; set; } = true;
}

public class UpdateBiometricDeviceDto
{
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = "Fingerprint";
    public bool IsActive { get; set; } = true;
}

public class PunchImportBatchDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; }
    public int TotalRecords { get; set; }
    public int SuccessCount { get; set; }
    public int FailCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ErrorDetails { get; set; }
    public Guid DeviceId { get; set; }
    public string? DeviceName { get; set; }
}

public class PunchImportRowDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public DateTime PunchTime { get; set; }
    public string? Direction { get; set; }
}

public class AdmsProcessResultDto
{
    public int Processed { get; set; }
    public int SkippedUnmapped { get; set; }
    public int Failed { get; set; }
}
