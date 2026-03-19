using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmergencyContact : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public string? HomeTelephone { get; set; }
    public string? MobileTelephone { get; set; }
    public string? WorkTelephone { get; set; }
}
