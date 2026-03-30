using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

/// <summary>Master list for People Hub profile attachments (Personal details).</summary>
public class EmployeeAttachmentType : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public ICollection<EmployeeAttachment> Attachments { get; set; } = new List<EmployeeAttachment>();
}
