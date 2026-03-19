using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Immigration : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string DocumentType { get; set; } = string.Empty; // Passport, Visa
    public string Number { get; set; } = string.Empty;
    public string? IssuedBy { get; set; }
    public DateTime? IssuedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public DateTime? EligibleReviewDate { get; set; }
    public string? EligibleStatus { get; set; }
    public string? Comments { get; set; }
}
