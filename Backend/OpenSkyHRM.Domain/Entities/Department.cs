using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Department : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }

    public Guid? ParentDepartmentId { get; set; }
    public Department? ParentDepartment { get; set; }

    /// <summary>Optional legal entity / subsidiary (organizational slice below company).</summary>
    public Guid? BusinessUnitId { get; set; }
    public BusinessUnit? BusinessUnit { get; set; }

    public ICollection<Department> SubDepartments { get; set; } = new List<Department>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<Position> Positions { get; set; } = new List<Position>();
}
