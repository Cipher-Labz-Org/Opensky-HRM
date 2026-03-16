namespace OpenSkyHRM.Application.DTOs.Organization;

public class EmployeeDto
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public DateTime JoinDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? DepartmentName { get; set; }
    public string? BusinessUnitName { get; set; }
    public string? PositionTitle { get; set; }
    public string? LocationName { get; set; }
    public string? GradeName { get; set; }
    public string? JobTitleName { get; set; }
    public string? ManagerName { get; set; }
    public Guid? ManagerId { get; set; }
}

public class CreateEmployeeDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public DateTime JoinDate { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? GradeId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? ManagerId { get; set; }
}

public class UpdateEmployeeDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid DepartmentId { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? GradeId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? ManagerId { get; set; }
}
