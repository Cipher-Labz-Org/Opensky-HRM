using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class PunchImportBatch : AuditableEntity
{
    public string FileName { get; set; } = string.Empty;
    public DateTime ImportedAt { get; set; }
    public int TotalRecords { get; set; }
    public int SuccessCount { get; set; }
    public int FailCount { get; set; }
    public string Status { get; set; } = "Pending";
    public string? ErrorDetails { get; set; }

    public Guid DeviceId { get; set; }
    public BiometricDevice Device { get; set; } = null!;
}
