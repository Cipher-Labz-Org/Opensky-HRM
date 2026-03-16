using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Candidate : AuditableEntity
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? ResumeUrl { get; set; }
    public string Source { get; set; } = string.Empty;
    public string Stage { get; set; } = "Sourced";

    public Guid RequisitionId { get; set; }
    public Requisition Requisition { get; set; } = null!;

    public ICollection<Interview> Interviews { get; set; } = new List<Interview>();
    public Offer? Offer { get; set; }
}
