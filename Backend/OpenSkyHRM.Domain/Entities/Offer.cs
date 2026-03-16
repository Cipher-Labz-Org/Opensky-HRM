using OpenSkyHRM.Domain.Common;
using OpenSkyHRM.Domain.Enums;

namespace OpenSkyHRM.Domain.Entities;

public class Offer : AuditableEntity
{
    public decimal SalaryOffered { get; set; }
    public string? Currency { get; set; } = "LKR";
    public DateTime OfferDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? Remarks { get; set; }

    public Guid CandidateId { get; set; }
    public Candidate Candidate { get; set; } = null!;
}
