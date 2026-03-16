namespace OpenSkyHRM.Application.DTOs.Recruitment;

public class RequisitionDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public string? DepartmentName { get; set; }
    public string? JobTitleName { get; set; }
    public string? HiringManagerName { get; set; }
    public int CandidateCount { get; set; }
}

public class CreateRequisitionDto
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int Vacancies { get; set; } = 1;
    public DateTime? TargetDate { get; set; }
    public string? Priority { get; set; }
    public Guid DepartmentId { get; set; }
    public Guid? JobTitleId { get; set; }
    public Guid? HiringManagerId { get; set; }
}

public class CandidateDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Stage { get; set; } = string.Empty;
    public string? RequisitionTitle { get; set; }
    public Guid RequisitionId { get; set; }
}

public class CreateCandidateDto
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Source { get; set; } = string.Empty;
    public Guid RequisitionId { get; set; }
}

public class OnboardingTaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool IsCompleted { get; set; }
    public DateTime? DueDate { get; set; }
    public string? EmployeeName { get; set; }
    public Guid EmployeeId { get; set; }
}
