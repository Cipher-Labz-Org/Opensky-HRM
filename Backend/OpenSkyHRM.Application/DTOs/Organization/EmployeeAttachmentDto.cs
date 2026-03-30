namespace OpenSkyHRM.Application.DTOs.Organization;

public class EmployeeAttachmentDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long Size { get; set; }
    /// <summary>File MIME type (e.g. application/pdf).</summary>
    public string ContentType { get; set; } = string.Empty;
    public DateTime DateAdded { get; set; }
    public string? AddedBy { get; set; }

    public Guid? AttachmentTypeId { get; set; }
    public string? AttachmentTypeName { get; set; }
    public DateTime? ExpiryDate { get; set; }
}

public class EmployeeAttachmentTypeCatalogDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public class CreateEmployeeAttachmentTypeDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public class UpdateEmployeeAttachmentRequest
{
    public string? Description { get; set; }
    public Guid AttachmentTypeId { get; set; }
    public string? ExpiryDate { get; set; }
}
