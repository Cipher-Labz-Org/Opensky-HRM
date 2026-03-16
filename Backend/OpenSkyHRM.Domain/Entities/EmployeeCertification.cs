using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeCertification : AuditableEntity
{
    public DateTime ObtainedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? CertificateNumber { get; set; }
    public string Status { get; set; } = "Active";

    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid CertificationId { get; set; }
    public Certification Certification { get; set; } = null!;
}
