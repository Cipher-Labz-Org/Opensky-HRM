using OpenSkyHRM.Domain.Common;

namespace OpenSkyHRM.Domain.Entities;

public class EmployeeAttachment : AuditableEntity
{
    public Guid EmployeeId { get; set; }
    public Employee Employee { get; set; } = null!;
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long Size { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public string? AddedBy { get; set; }

    public Guid? AttachmentTypeId { get; set; }
    public EmployeeAttachmentType? AttachmentType { get; set; }

    public DateTime? ExpiryDate { get; set; }
}
