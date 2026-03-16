using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class JobTitle : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<Position> Positions { get; set; } = new List<Position>();
}
