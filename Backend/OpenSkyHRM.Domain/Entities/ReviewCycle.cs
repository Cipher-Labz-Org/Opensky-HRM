using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class ReviewCycle : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string CycleType { get; set; } = "Quarterly";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Status { get; set; } = "Open";

    public ICollection<Goal> Goals { get; set; } = new List<Goal>();
    public ICollection<PerformanceReview> Reviews { get; set; } = new List<PerformanceReview>();
}
