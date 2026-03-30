using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Education : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string Level { get; set; } = string.Empty;
    public string? QualificationName { get; set; }
    public string? Institute { get; set; }
    public string? Major { get; set; }
    public string? Year { get; set; }
    public string? GpaScore { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Remark { get; set; }
}
