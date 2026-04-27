using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class BiometricPunchEvent : AuditableEntity
{
    public Guid DeviceId { get; set; }
    public BiometricDevice Device { get; set; } = null!;

    public Guid? RawEventId { get; set; }
    public BiometricRawEvent? RawEvent { get; set; }

    public string DeviceUserId { get; set; } = string.Empty;
    public DateTime PunchAtUtc { get; set; }
    public string? PunchState { get; set; }
    public string? VerifyMode { get; set; }
    public string? ExternalLogId { get; set; }
    public string DedupeHash { get; set; } = string.Empty;
    public bool ProcessedToAttendance { get; set; }
}

