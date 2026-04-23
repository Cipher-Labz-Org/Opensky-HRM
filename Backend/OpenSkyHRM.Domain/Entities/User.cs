using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class User : AuditableEntity
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<UserAssignedLocation> AssignedLocations { get; set; } = new List<UserAssignedLocation>();
    public ICollection<UserAssignedBusinessUnit> AssignedBusinessUnits { get; set; } = new List<UserAssignedBusinessUnit>();
    public ICollection<UserAssignedGrade> AssignedGrades { get; set; } = new List<UserAssignedGrade>();
    public ICollection<UserAssignedJobTitle> AssignedJobTitles { get; set; } = new List<UserAssignedJobTitle>();
}
