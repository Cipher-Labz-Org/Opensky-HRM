namespace OpenSkyHRM.Application.DTOs.Organization;

public class EmployeeDto
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AddressStreet1 { get; set; }
    public string? AddressStreet2 { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? StateProvince { get; set; }
    public string? ZipPostalCode { get; set; }
    public string? PollingDivision { get; set; }
    public string? DistanceToOffice { get; set; }
    public string? ModeOfTransport { get; set; }
    public string? HomeTelephone { get; set; }
    public string? WorkTelephone { get; set; }
    public string? OtherEmail { get; set; }
    public string? PermanentStreet1 { get; set; }
    public string? PermanentStreet2 { get; set; }
    public string? PermanentCity { get; set; }
    public string? PermanentCountry { get; set; }
    public string? PermanentStateProvince { get; set; }
    public string? PermanentZipPostalCode { get; set; }
    public string? PermanentPollingDivision { get; set; }
    public string? PermanentDistanceToOffice { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? MaritalStatus { get; set; }
    public string? Nationality { get; set; }
    public string? Religion { get; set; }
    public string? Ethnicity { get; set; }
    public string? OtherId { get; set; }
    public string? NationalId { get; set; }
    public string? TinNumber { get; set; }
    public string? EpfNumber { get; set; }
    public string? EtfNumber { get; set; }
    public string? DriversLicenseNumber { get; set; }
    public DateTime? LicenseExpiryDate { get; set; }
    public string? DriversLicenseIssuingCountry { get; set; }
    public DateTime JoinDate { get; set; }
    public DateTime? ProbationEndDate { get; set; }
    public DateTime? DateOfPermanency { get; set; }
    public DateTime? TerminationDate { get; set; }
    public string? TerminationReason { get; set; }
    public string? TerminationNote { get; set; }
    public string Status { get; set; } = string.Empty;

    public Guid DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public string? BusinessUnitName { get; set; }
    public Guid? PositionId { get; set; }
    public string? PositionTitle { get; set; }
    public Guid? LocationId { get; set; }
    public string? LocationName { get; set; }
    public Guid? GradeId { get; set; }
    public string? GradeName { get; set; }
    public Guid? JobTitleId { get; set; }
    public string? JobTitleName { get; set; }
    public Guid? ManagerId { get; set; }
    public string? ManagerName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public bool IsTopOfHierarchy { get; set; }
    public bool HasDirectSupervisor { get; set; }
}

public class CreateEmployeeDto
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AddressStreet1 { get; set; }
    public string? AddressStreet2 { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? StateProvince { get; set; }
    public string? ZipPostalCode { get; set; }
    public string? PollingDivision { get; set; }
    public string? DistanceToOffice { get; set; }
    public string? ModeOfTransport { get; set; }
    public string? HomeTelephone { get; set; }
    public string? WorkTelephone { get; set; }
    public string? OtherEmail { get; set; }
    public string? PermanentStreet1 { get; set; }
    public string? PermanentStreet2 { get; set; }
    public string? PermanentCity { get; set; }
    public string? PermanentCountry { get; set; }
    public string? PermanentStateProvince { get; set; }
    public string? PermanentZipPostalCode { get; set; }
    public string? PermanentPollingDivision { get; set; }
    public string? PermanentDistanceToOffice { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? MaritalStatus { get; set; }
    public string? Nationality { get; set; }
    public string? Religion { get; set; }
    public string? Ethnicity { get; set; }
    public string? OtherId { get; set; }
    public string? NationalId { get; set; }
    public string? TinNumber { get; set; }
    public string? EpfNumber { get; set; }
    public string? EtfNumber { get; set; }
    public string? DriversLicenseNumber { get; set; }
    public DateTime? LicenseExpiryDate { get; set; }
    public string? DriversLicenseIssuingCountry { get; set; }
    public DateTime JoinDate { get; set; }
    public DateTime? ProbationEndDate { get; set; }
    public DateTime? DateOfPermanency { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? GradeId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? ManagerId { get; set; }

    public CreateLoginDto? CreateLogin { get; set; }

    public bool WithOnboarding { get; set; }
    public Guid? OnboardingTemplateId { get; set; }
}

public class CreateLoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<Guid> RoleIds { get; set; } = new();
}

public class UpdateEmployeeDto
{
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? AddressStreet1 { get; set; }
    public string? AddressStreet2 { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? StateProvince { get; set; }
    public string? ZipPostalCode { get; set; }
    public string? PollingDivision { get; set; }
    public string? DistanceToOffice { get; set; }
    public string? ModeOfTransport { get; set; }
    public string? HomeTelephone { get; set; }
    public string? WorkTelephone { get; set; }
    public string? OtherEmail { get; set; }
    public string? PermanentStreet1 { get; set; }
    public string? PermanentStreet2 { get; set; }
    public string? PermanentCity { get; set; }
    public string? PermanentCountry { get; set; }
    public string? PermanentStateProvince { get; set; }
    public string? PermanentZipPostalCode { get; set; }
    public string? PermanentPollingDivision { get; set; }
    public string? PermanentDistanceToOffice { get; set; }
    public DateTime DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? MaritalStatus { get; set; }
    public string? Nationality { get; set; }
    public string? Religion { get; set; }
    public string? Ethnicity { get; set; }
    public string? OtherId { get; set; }
    public string? NationalId { get; set; }
    public string? TinNumber { get; set; }
    public string? EpfNumber { get; set; }
    public string? EtfNumber { get; set; }
    public string? DriversLicenseNumber { get; set; }
    public DateTime? LicenseExpiryDate { get; set; }
    public string? DriversLicenseIssuingCountry { get; set; }
    public DateTime? JoinDate { get; set; }
    public DateTime? ProbationEndDate { get; set; }
    public DateTime? DateOfPermanency { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? TerminationDate { get; set; }
    public string? TerminationReason { get; set; }
    public string? TerminationNote { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? BusinessUnitId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? LocationId { get; set; }
    public Guid? GradeId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? ManagerId { get; set; }
    public bool IsTopOfHierarchy { get; set; }
}
