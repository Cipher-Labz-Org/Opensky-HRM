namespace OpenSkyHRM.Application.DTOs.Organization;

public class EmployeeAttachmentDto
{
    public Guid Id { get; set; }
    public Guid EmployeeId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long Size { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public DateTime DateAdded { get; set; }
    public string? AddedBy { get; set; }
}
