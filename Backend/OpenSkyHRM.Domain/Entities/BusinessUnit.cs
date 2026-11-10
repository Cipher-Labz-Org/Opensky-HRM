using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class BusinessUnit : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>When true, employees of this business unit may punch in and out in the mobile app.</summary>
    public bool AllowMobilePunch { get; set; }

    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<AttendancePlace> AttendancePlaces { get; set; } = new List<AttendancePlace>();
}
