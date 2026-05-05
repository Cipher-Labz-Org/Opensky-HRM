using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class BiometricRawEvent : AuditableEntity
{
    public Guid? DeviceId { get; set; }
    public BiometricDevice? Device { get; set; }

    public string EventType { get; set; } = "logs";
    public DateTime ReceivedAtUtc { get; set; }
    public string Payload { get; set; } = string.Empty;
    public string? SourceIp { get; set; }

    public string ParseStatus { get; set; } = "Pending";
    public string? ParseError { get; set; }
}

