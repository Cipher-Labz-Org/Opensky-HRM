using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class Employee : AuditableEntity
{
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? AddressStreet1 { get; set; }
    public string? AddressStreet2 { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public string? StateProvince { get; set; }
    public string? ZipPostalCode { get; set; }
    public string? District { get; set; }
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
    public string? PermanentDistrict { get; set; }
    public string? PermanentPollingDivision { get; set; }
    public string? PermanentDistanceToOffice { get; set; }
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Nationality { get; set; }
    public string? Religion { get; set; }
    public string? Ethnicity { get; set; }
    public string? OtherId { get; set; }
    /// <summary>Biometric device PIN / user ID when it differs from <see cref="EmployeeCode"/>.</summary>
    public string? FingerprintId { get; set; }
    public string? NationalId { get; set; }
    public string? TinNumber { get; set; }
    public string? EpfNumber { get; set; }
    public string? EtfNumber { get; set; }
    public string? DriversLicenseNumber { get; set; }
    public string? DriversLicenseType { get; set; }
    public DateTime? LicenseIssueDate { get; set; }
    public DateTime? LicenseExpiryDate { get; set; }
    public string? DriversLicenseIssuingCountry { get; set; }
    public DateTime JoinDate { get; set; }
    public DateTime? ProbationEndDate { get; set; }
    public DateTime? DateOfPermanency { get; set; }
    public DateTime? TerminationDate { get; set; }
    public string? TerminationReason { get; set; }
    public string? TerminationNote { get; set; }
    public string Status { get; set; } = "Active";
    public string EmploymentType { get; set; } = "FullTimePermanent";
    public string? ProfileImageUrl { get; set; }
    public bool IsTopOfHierarchy { get; set; }

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

    public Guid? ShiftPatternId { get; set; }
    public ShiftPattern? ShiftPattern { get; set; }

    public Guid? ManagerId { get; set; }
    public Employee? Manager { get; set; }
    public ICollection<Employee> DirectReports { get; set; } = new List<Employee>();
    public ICollection<EmployeeAttachment> Attachments { get; set; } = new List<EmployeeAttachment>();
    public ICollection<EmergencyContact> EmergencyContacts { get; set; } = new List<EmergencyContact>();
    public ICollection<Dependent> Dependents { get; set; } = new List<Dependent>();
    public ICollection<Education> Educations { get; set; } = new List<Education>();
    public ICollection<EmployeeSkill> Skills { get; set; } = new List<EmployeeSkill>();
    public ICollection<EmployeeLanguage> Languages { get; set; } = new List<EmployeeLanguage>();
    public ICollection<EmployeeBenefit> Benefits { get; set; } = new List<EmployeeBenefit>();
    public ICollection<EmployeeDriverLicense> DriverLicenses { get; set; } = new List<EmployeeDriverLicense>();
    public ICollection<Immigration> Immigrations { get; set; } = new List<Immigration>();
    public ICollection<ImmigrationDocument> ImmigrationDocuments { get; set; } = new List<ImmigrationDocument>();
    public ICollection<WorkExperience> WorkExperiences { get; set; } = new List<WorkExperience>();
    public ICollection<BankAccount> BankAccounts { get; set; } = new List<BankAccount>();

    public string FullName => string.IsNullOrWhiteSpace(MiddleName)
        ? $"{FirstName} {LastName}"
        : $"{FirstName} {MiddleName} {LastName}";
}
