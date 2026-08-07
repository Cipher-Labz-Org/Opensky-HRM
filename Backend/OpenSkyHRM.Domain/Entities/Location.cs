using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Location : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<Position> Positions { get; set; } = new List<Position>();
    public ICollection<UserAssignedLocation> UserAssignments { get; set; } = new List<UserAssignedLocation>();
    public ICollection<AttendancePlace> AttendancePlaces { get; set; } = new List<AttendancePlace>();
}
