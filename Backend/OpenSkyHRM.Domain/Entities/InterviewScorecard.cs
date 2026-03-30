using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class InterviewScorecard : AuditableEntity
{
    public string Criteria { get; set; } = string.Empty;
    public int Rating { get; set; }
    public string? Comment { get; set; }

    public Guid InterviewId { get; set; }
    public Interview Interview { get; set; } = null!;
}
