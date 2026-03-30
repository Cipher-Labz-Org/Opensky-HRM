using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class TrainingAssignment : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;

    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;

    /// <summary>Optional HR/manager employee who created the assignment.</summary>
    public Guid? AssignedByEmployeeId { get; set; }
    public Employee? AssignedBy { get; set; }

    public DateTime AssignedAt { get; set; }
    public DateTime? DueDate { get; set; }

    /// <summary>Assigned, InProgress, Completed, Waived, Expired, Failed</summary>
    public string Status { get; set; } = "Assigned";

    public DateTime? CompletedAt { get; set; }
    public int? ScorePercent { get; set; }
    public string? EvidenceUrl { get; set; }
    public string? ExternalTranscriptId { get; set; }
    public string? Notes { get; set; }
    public string? WaiverReason { get; set; }

    /// <summary>Used by reminder job to avoid emailing more than once per UTC day.</summary>
    public DateTime? LastDueReminderSentAt { get; set; }
}
