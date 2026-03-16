using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Interview : AuditableEntity
{
    public DateTime ScheduledAt { get; set; }
    public string? InterviewerName { get; set; }
    public string? InterviewType { get; set; }
    public string? Feedback { get; set; }
    public string? Result { get; set; }

    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;
}
