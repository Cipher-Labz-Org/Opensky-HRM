using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class User : AuditableEntity
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    /// <summary>When true, the user must change password before using the app (set after bulk import logins, cleared on successful change).</summary>
    public bool MustChangePassword { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }

    public Guid? EmployeeId { get; set; }
    public Employee? Employee { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
    public ICollection<UserAssignedLocation> AssignedLocations { get; set; } = new List<UserAssignedLocation>();
    public ICollection<UserAssignedBusinessUnit> AssignedBusinessUnits { get; set; } = new List<UserAssignedBusinessUnit>();
    public ICollection<UserAssignedGrade> AssignedGrades { get; set; } = new List<UserAssignedGrade>();
    public ICollection<UserAssignedJobTitle> AssignedJobTitles { get; set; } = new List<UserAssignedJobTitle>();
    public ICollection<UserAssignedCompanyProfile> AssignedCompanyProfiles { get; set; } = new List<UserAssignedCompanyProfile>();
}
