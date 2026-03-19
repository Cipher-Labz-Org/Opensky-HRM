using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeBenefit : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string? InsuranceProvider { get; set; }
    public bool CoverageExtendedMedical { get; set; }
    public bool CoverageDental { get; set; }
    public bool CoverageVision { get; set; }
    public bool SpousalCoverage { get; set; }
    public bool DependentsCovered { get; set; }
}
