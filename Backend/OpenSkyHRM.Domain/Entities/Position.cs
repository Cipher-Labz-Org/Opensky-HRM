using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Position : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsVacant { get; set; } = true;

    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public Guid? JobTitleId { get; set; }
    public JobTitle? JobTitle { get; set; }

    public Guid? ReportsToPositionId { get; set; }
    public Position? ReportsToPosition { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
