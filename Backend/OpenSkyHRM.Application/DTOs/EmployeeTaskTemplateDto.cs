namespace OpenSkyHRM.Application.DTOs;

public class EmployeeTaskTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int ItemCount { get; set; }
    public List<EmployeeTaskTemplateItemDto> Items { get; set; } = new();
}

public class EmployeeTaskTemplateItemDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
    public string? AssignedToUserName { get; set; }
}

public class CreateEmployeeTaskTemplateDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = "Offboarding";
    public bool IsActive { get; set; } = true;
}

public class CreateEmployeeTaskTemplateItemDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string AssignmentType { get; set; } = "User";
    public Guid? AssignedToUserId { get; set; }
}

public class EmployeeTaskLookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public int ItemCount { get; set; }
}
