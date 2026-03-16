using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class Employee : AuditableEntity
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public DateTime JoinDate { get; set; }
    public DateTime? TerminationDate { get; set; }
    public EmploymentStatus Status { get; set; } = EmploymentStatus.Active;
    public string? ProfileImageUrl { get; set; }

    public Guid DepartmentId { get; set; }
    public Department Department { get; set; } = null!;

    public Guid? BusinessUnitId { get; set; }
    public BusinessUnit? BusinessUnit { get; set; }

    public Guid? PositionId { get; set; }
    public Position? Position { get; set; }

    public Guid? LocationId { get; set; }
    public Location? Location { get; set; }

    public Guid? GradeId { get; set; }
    public Grade? Grade { get; set; }

    public Guid? JobTitleId { get; set; }
    public JobTitle? JobTitle { get; set; }

    public Guid? ManagerId { get; set; }
    public Employee? Manager { get; set; }
    public ICollection<Employee> DirectReports { get; set; } = new List<Employee>();

    public string FullName => $"{FirstName} {LastName}";
}
