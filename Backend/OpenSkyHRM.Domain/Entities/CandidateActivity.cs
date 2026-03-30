using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class CandidateActivity : BaseEntity
{
    public string ActivityType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? PerformedBy { get; set; }
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;

    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;
}
