using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>
/// When present, People access is limited to employees on these company profiles (multi-company).
/// </summary>
public class UserAssignedCompanyProfile : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string CompanyProfileKey { get; set; } = "primary";
}
