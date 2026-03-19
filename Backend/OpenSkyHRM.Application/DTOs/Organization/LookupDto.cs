namespace OpenSkyHRM.Application.DTOs.Organization;

public class LookupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class BusinessUnitDto : LookupDto
{
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public int EmployeeCount { get; set; }
}

public class LocationDto : LookupDto
{
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
    public bool IsActive { get; set; }
}

public class GradeDto : LookupDto
{
    public int Level { get; set; }
    public string? Description { get; set; }
}

public class JobTitleDto : LookupDto
{
    public string? Description { get; set; }
}

public class PositionDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsVacant { get; set; }
    public string? DepartmentName { get; set; }
    public string? LocationName { get; set; }
    public string? JobTitleName { get; set; }
}

public class CreateLookupDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class CreateGradeDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int Level { get; set; }
    public string? Description { get; set; }
}

public class CreateJobTitleDto
{
    public string Title { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
}
