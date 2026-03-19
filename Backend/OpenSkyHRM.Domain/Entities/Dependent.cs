using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Dependent : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Relationship { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Occupation { get; set; }
    public string? Organization { get; set; }
}
