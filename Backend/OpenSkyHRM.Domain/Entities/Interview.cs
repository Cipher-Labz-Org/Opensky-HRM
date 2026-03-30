using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Interview : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public DateTime ScheduledAt { get; set; }
    public int Duration { get; set; } = 60;
    public string? Location { get; set; }
    public string? InterviewType { get; set; }
    public string Status { get; set; } = "Scheduled";
    public string? Feedback { get; set; }
    public string? Result { get; set; }
    public int? OverallRating { get; set; }
    public string? Recommendation { get; set; }

    public string? InterviewerName { get; set; }
    public Guid? InterviewerId { get; set; }
    public Employee? Interviewer { get; set; }

    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;

    public ICollection<InterviewScorecard> Scorecards { get; set; } = new List<InterviewScorecard>();
}
