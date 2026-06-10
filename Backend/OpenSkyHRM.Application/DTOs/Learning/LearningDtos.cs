namespace OpenSkyHRM.Application.DTOs.Learning;

public class CreateCourseRequest
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Provider { get; set; }
    public int DurationHours { get; set; } = 1;
    public string? Category { get; set; }
    public bool IsMandatory { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCourseRequest
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Provider { get; set; }
    public int DurationHours { get; set; }
    public string? Category { get; set; }
    public bool IsMandatory { get; set; }
    public bool IsActive { get; set; } = true;
}

public class TrainingAssignmentDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public Guid CourseId { get; set; }
    public string CourseTitle { get; set; } = string.Empty;
    public string CourseCode { get; set; } = string.Empty;
    public Guid? AssignedByEmployeeId { get; set; }
    public DateTime AssignedAt { get; set; }
    public DateTime? DueDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? CompletedAt { get; set; }
    public int? ScorePercent { get; set; }
    public string? EvidenceUrl { get; set; }
    public string? ExternalTranscriptId { get; set; }
    public string? Notes { get; set; }
    public string? WaiverReason { get; set; }
}

public class CreateTrainingAssignmentRequest
{
    public Guid EmployeeId { get; set; }
    public Guid CourseId { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Notes { get; set; }
}

public class BulkCreateTrainingAssignmentRequest
{
    public List<Guid> EmployeeIds { get; set; } = [];
    public Guid CourseId { get; set; }
    public DateTime? DueDate { get; set; }
    public string? Notes { get; set; }
}

public class UpdateTrainingAssignmentRequest
{
    public string Status { get; set; } = string.Empty;
    public DateTime? DueDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int? ScorePercent { get; set; }
    public string? EvidenceUrl { get; set; }
    public string? ExternalTranscriptId { get; set; }
    public string? Notes { get; set; }
    public string? WaiverReason { get; set; }
}

public class CertificationCatalogDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? IssuingBody { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateCertificationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? IssuingBody { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCertificationRequest
{
    public string Name { get; set; } = string.Empty;
    public string? IssuingBody { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class EmployeeCertificationDto
{
    public Guid Id { get; set; }
    public Guid CertificationId { get; set; }
    public string CertificationName { get; set; } = string.Empty;
    public DateTime ObtainedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? CertificateNumber { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class EmployeeCertificationListItemDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public Guid CertificationId { get; set; }
    public string CertificationName { get; set; } = string.Empty;
    public DateTime ObtainedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? CertificateNumber { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class CreateEmployeeCertificationRequest
{
    public Guid CertificationId { get; set; }
    public DateTime ObtainedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? CertificateNumber { get; set; }
    public string Status { get; set; } = "Active";
}

public class UpdateEmployeeCertificationRequest
{
    public DateTime ObtainedDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public string? CertificateNumber { get; set; }
    public string Status { get; set; } = "Active";
}

public class CreateSkillRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class CreateSkillMatrixRequest
{
    public Guid EmployeeId { get; set; }
    public Guid SkillId { get; set; }
    public int ProficiencyLevel { get; set; }
    public string? Notes { get; set; }
    public DateTime? AssessedAt { get; set; }
}

public class UpdateSkillMatrixRequest
{
    public int ProficiencyLevel { get; set; }
    public string? Notes { get; set; }
    public DateTime? AssessedAt { get; set; }
}

public class LearningCertificationSummaryDto
{
    public Guid CertificationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int AssignedCount { get; set; }
    public int ExpiringWithin90Days { get; set; }
}

public class LearningSkillCoverageDto
{
    public Guid SkillId { get; set; }
    public string SkillName { get; set; } = string.Empty;
    public int EmployeeCountWithSkill { get; set; }
    public int TotalActiveEmployees { get; set; }
}
