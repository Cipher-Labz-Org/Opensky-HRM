using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeTaskTemplate : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = "Offboarding"; // "Onboarding" or "Offboarding"
    public bool IsActive { get; set; } = true;

    public ICollection<EmployeeTaskTemplateItem> Items { get; set; } = new List<EmployeeTaskTemplateItem>();
}
