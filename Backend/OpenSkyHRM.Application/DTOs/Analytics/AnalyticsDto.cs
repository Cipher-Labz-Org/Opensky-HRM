namespace OpenSkyHRM.Application.DTOs.Analytics;

public class HeadcountAnalyticsDto
{
    public int TotalEmployees { get; set; }
    public int ActiveEmployees { get; set; }
    public int OnLeave { get; set; }
    public int Terminated { get; set; }
    public int Probation { get; set; }
    public Dictionary<string, int> ByDepartment { get; set; } = new();
    public Dictionary<string, int> ByBusinessUnit { get; set; } = new();
}

public class ReportDefinitionDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string OutputFormat { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
