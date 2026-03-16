using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class Holiday : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public bool IsRestricted { get; set; }
    public string? Description { get; set; }
    public int Year { get; set; }
}
