namespace OpenSkyHRM.Application.DTOs.Organization;

public class ReportingHierarchyNodeDto
{
    public Guid Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? JobTitleName { get; set; }
    public string? DepartmentName { get; set; }
    public bool IsTopOfHierarchy { get; set; }
    public List<ReportingHierarchyNodeDto> Children { get; set; } = new();
}
