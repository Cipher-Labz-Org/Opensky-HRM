namespace OpenSkyHRM.Application.DTOs.Reports;

public class ReportCategoryDto
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public List<ReportItemDto> Reports { get; set; } = new();
}

public class ReportItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    /// <summary>When true, the report accepts optional <c>departmentId</c> (GUID) to limit rows to one department.</summary>
    public bool SupportsDepartmentFilter { get; set; }
    /// <summary>
    /// UI period control: <c>none</c>, <c>dateRange</c> (from/to), <c>yearMonth</c> (year/month plus from/to), <c>singleDate</c> (date), <c>monthOnly</c> (month 1–12).
    /// </summary>
    public string PeriodFilterMode { get; set; } = "none";
}

public class ReportResultDto
{
    public string ReportName { get; set; } = string.Empty;
    public string GeneratedAt { get; set; } = string.Empty;
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public int TotalRows { get; set; }
}
