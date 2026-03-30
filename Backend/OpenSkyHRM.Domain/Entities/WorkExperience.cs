using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class WorkExperience : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string? EmploymentType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool Creditable { get; set; }
    public string? Comment { get; set; }
}
