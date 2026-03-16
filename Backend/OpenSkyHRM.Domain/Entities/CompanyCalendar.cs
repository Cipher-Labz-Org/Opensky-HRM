using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class CompanyCalendar : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public int Year { get; set; }
    public string? WorkWeek { get; set; } = "Mon-Fri";
    public string? Country { get; set; }
    public bool IsDefault { get; set; }
}
