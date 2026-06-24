using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Holiday : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    /// <summary>Public, Mercantile, Poya, or Restricted.</summary>
    public string Kind { get; set; } = HolidayKinds.Public;
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
    /// <summary>ISO country code (LK, US, GB, IN, AU).</summary>
    public string CountryCode { get; set; } = HolidayCountryCodes.LK;
}
