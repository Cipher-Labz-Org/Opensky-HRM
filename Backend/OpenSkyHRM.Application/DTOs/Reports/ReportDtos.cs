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
}

public class ReportResultDto
{
    public string ReportName { get; set; } = string.Empty;
    public string GeneratedAt { get; set; } = string.Empty;
    public List<string> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public int TotalRows { get; set; }
}
