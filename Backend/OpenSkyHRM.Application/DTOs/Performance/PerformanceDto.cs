namespace OpenSkyHRM.Application.DTOs.Performance;

public class GoalDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public int Weight { get; set; }
    public decimal Progress { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public string? EmployeeName { get; set; }
    public Guid EmployeeId { get; set; }
}

public class ReviewCycleDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string CycleType { get; set; } = string.Empty;
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class PerformanceReviewDto
{
    public Guid Id { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string CycleName { get; set; } = string.Empty;
    public decimal? OverallRating { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class CourseDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Provider { get; set; }
    public int DurationHours { get; set; }
    public string? Category { get; set; }
    public bool IsMandatory { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SkillDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
}

public class SkillMatrixDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid SkillId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string SkillName { get; set; } = string.Empty;
    public int ProficiencyLevel { get; set; }
    public DateTime? AssessedAt { get; set; }
    public string? Notes { get; set; }
}
