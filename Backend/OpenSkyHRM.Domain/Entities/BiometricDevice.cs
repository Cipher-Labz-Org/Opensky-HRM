using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class BiometricDevice : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string SerialNumber { get; set; } = string.Empty;
    public string? Location { get; set; }
    public string DeviceType { get; set; } = "Fingerprint";
    public bool IsActive { get; set; } = true;
    public DateTime? LastSyncAt { get; set; }
}
